from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Depends
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uuid
from agent import run_firereach_agent
from auth import get_current_user, create_access_token, ADMIN_PASSWORD
from database import (
    jobs_collection, get_job_state, update_job_state, campaigns_collection, 
    get_campaign_state, add_job_to_campaign, get_workspace_settings, 
    update_workspace_settings, templates_collection
)
from discover import discover_companies_raw, discover_leads_raw
from tools import tool_signal_harvester, tool_research_analyst, tool_outreach_automated_sender
from models import JobState, CampaignState, WorkspaceSettings, WorkspaceTemplate
from websocket_manager import manager

app = FastAPI(title="FireReach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AgentRequest(BaseModel):
    icp: str
    company: Optional[str] = None
    email: Optional[str] = None

class LoginRequest(BaseModel):
    password: str

class JobResponse(BaseModel):
    id: str
    status: str

class CampaignRequest(BaseModel):
    name: str
    icp: str
    target_count: int = 5

class CampaignResponse(BaseModel):
    id: str
    status: str

class DiscoverCompaniesRequest(BaseModel):
    icp: str

class DiscoverLeadsRequest(BaseModel):
    icp: str
    company: str
    domain: str

@app.post("/api/discover/companies", dependencies=[Depends(get_current_user)])
async def api_discover_companies(req: DiscoverCompaniesRequest):
    return await discover_companies_raw(req.icp)

@app.post("/api/discover/leads", dependencies=[Depends(get_current_user)])
async def api_discover_leads(req: DiscoverLeadsRequest):
    return await discover_leads_raw(req.company, req.domain, req.icp)

class AutopilotRequest(BaseModel):
    icp: str

@app.post("/api/discover/autopilot", dependencies=[Depends(get_current_user)])
async def api_discover_autopilot(req: AutopilotRequest):
    """
    Automated chain: ICP -> Companies -> Top Leads for each company.
    Returns a flattened list of discovered leads across all companies.
    """
    try:
        companies = await discover_companies_raw(req.icp)
        all_leads = []
        for comp in companies[:3]: # Limit to top 3 for speed
            leads = await discover_leads_raw(comp['name'], comp['domain'], req.icp)
            for l in leads[:2]: # Top 2 per company
                l['company_name'] = comp['name']
                l['company_domain'] = comp['domain']
                all_leads.append(l)
        return all_leads
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workspace/settings", dependencies=[Depends(get_current_user)])
async def api_get_settings():
    return await get_workspace_settings()

class UpdateSettingsRequest(BaseModel):
    persona_prompt: Optional[str] = None
    groq_api_key: Optional[str] = None
    serper_api_key: Optional[str] = None
    hunter_api_key: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    sender_email: Optional[str] = None

@app.patch("/api/workspace/settings", dependencies=[Depends(get_current_user)])
async def api_update_settings(req: UpdateSettingsRequest):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    await update_workspace_settings(updates)
    return {"status": "updated"}

@app.get("/api/workspace/templates", dependencies=[Depends(get_current_user)])
async def get_templates():
    cursor = templates_collection.find().sort("created_at", -1)
    templates = await cursor.to_list(length=100)
    for t in templates:
        t["id"] = t.pop("_id")
    return templates

@app.post("/api/workspace/templates", dependencies=[Depends(get_current_user)])
async def create_template(template: WorkspaceTemplate):
    res = await templates_collection.insert_one(template.dict(by_alias=True))
    return {"id": str(res.inserted_id)}

@app.post("/api/auth/token")
async def login(req: LoginRequest):
    if req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    token = create_access_token({"role": "admin"})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/api/campaigns", response_model=CampaignResponse, dependencies=[Depends(get_current_user)])
async def create_campaign(request: CampaignRequest, background_tasks: BackgroundTasks):
    try:
        new_campaign = CampaignState(
            name=request.name,
            icp=request.icp,
            target_count=request.target_count
        )
        await campaigns_collection.insert_one(new_campaign.dict(by_alias=True))
        
        # Async background execution for multiple jobs
        for i in range(request.target_count):
            new_job = JobState(icp=f"{request.icp} - variant {i+1}") # naive variance for now
            await jobs_collection.insert_one(new_job.dict(by_alias=True))
            await add_job_to_campaign(new_campaign.id, new_job.id)
            
            background_tasks.add_task(
                run_firereach_agent, 
                new_job.id, 
                new_job.icp, 
                None, 
                None
            )
            
        return {"id": new_campaign.id, "status": "running"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/campaigns", dependencies=[Depends(get_current_user)])
async def list_campaigns():
    cursor = campaigns_collection.find().sort("created_at", -1)
    camps = await cursor.to_list(length=100)
    for c in camps:
        c["id"] = c.pop("_id")
    return camps

@app.get("/api/campaigns/{campaign_id}/jobs", dependencies=[Depends(get_current_user)])
async def get_campaign_jobs(campaign_id: str):
    campaign = await get_campaign_state(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    job_ids = campaign.get("job_ids", [])
    cursor = jobs_collection.find({"_id": {"$in": job_ids}})
    jobs = await cursor.to_list(length=100)
    for j in jobs:
        j["id"] = j.pop("_id")
    return jobs

async def run_direct_workflow(job_id: str, icp: str, company: str, email: str, lead_name: str, lead_title: str):
    from database import current_job_id, update_job_state, get_job_state
    from websocket_manager import manager
    current_job_id.set(job_id)

    await update_job_state(job_id, {
        "status": "processing",
        "lead_name": lead_name,
        "lead_title": lead_title,
        "target_email": email,
        "target_company": company
    })

    # Direct bypass of LLM agent wrapper -> purely deterministic pipeline for exact targets
    try:
        await stream_thought(job_id, "AI: News Search", f"Locating latest growth signals for {company}...")
        sig_data = await tool_signal_harvester.ainvoke({"company": company})
        await update_job_state(job_id, {"signals": sig_data})
        
        await stream_thought(job_id, "AI: Analyst Mode", f"Analyzing tech stack and ICP fit for {company}...")
        res_data = await tool_research_analyst.ainvoke({"signals": str(sig_data), "icp": icp})
        await update_job_state(job_id, {"research": res_data})
        
        await stream_thought(job_id, "AI: Copywriting", f"Drafting personality-driven outreach for {lead_name}...")
        # Keeping the keys exactly as defined in tools.py for total connectivity
        await tool_outreach_automated_sender.ainvoke({
            "signals": str(res_data), # Use research result as the main signal
            "icp": icp,
            "company": company,
            "email_address": email
        })
        
        # Pull the draft from the DB that was just saved by the tool
        updated_job = await get_job_state(job_id)
        email_content = updated_job.get("email_draft")
        
        await update_job_state(job_id, {"generated_email": email_content, "status": "pending_approval"})
        
        # Final broadcast to trigger UI transition
        await manager.send_updates(job_id, {"event": "job_update", "updates": {"status": "pending_approval", "thought": "Draft complete. Ready for your review."}})
    except Exception as e:
        await update_job_state(job_id, {"status": "failed"})
        await manager.send_updates(job_id, {"event": "job_update", "updates": {"status": "failed", "error": str(e)}})
        print(f"Direct workflow failed: {e}")

class DirectJobRequest(BaseModel):
    icp: str
    company: str
    email: str
    lead_name: str
    lead_title: str

class ManualMailRequest(BaseModel):
    to_email: str
    subject: str
    body: str

@app.post("/api/jobs/direct", dependencies=[Depends(get_current_user)])
async def create_direct_job(request: DirectJobRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    icp = request.icp
    company = request.company
    email = request.email
    lead_name = request.lead_name
    lead_title = request.lead_title
    
    # Run in background to stay interactive
    background_tasks.add_task(
        run_direct_workflow, 
        job_id, 
        icp, 
        company, 
        email, 
        lead_name, 
        lead_title
    )
    
    return {"status": "dispatched", "job_id": job_id}

@app.post("/api/quick-manual-dispatch")
async def send_manual_mail(request: ManualMailRequest):
    try:
        from email_service import send_email
        print(f"ALERTA: Manual email attempt to {request.to_email}")
        result = send_email(request.to_email, request.subject, request.body)
        if result["status"] == "error":
            # Return 400 instead of 500 to differentiate SMTP errors from server crashes
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/jobs", response_model=JobResponse, dependencies=[Depends(get_current_user)])
async def create_job(request: AgentRequest, background_tasks: BackgroundTasks):
    try:
        new_job = JobState(
            icp=request.icp,
            company_input=request.company,
            email_input=request.email,
        )
        await jobs_collection.insert_one(new_job.dict(by_alias=True))
        
        # Async background execution
        background_tasks.add_task(
            run_firereach_agent, 
            new_job.id, 
            request.icp, 
            request.company, 
            request.email
        )
        return {"id": new_job.id, "status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/run-agent")
async def run_agent_endpoint(request: AgentRequest):
    """
    Synchronous endpoint for the frontend to run the agent and get results directly.
    """
    try:
        new_job = JobState(
            icp=request.icp,
            company_input=request.company,
            email_input=request.email,
        )
        await jobs_collection.insert_one(new_job.dict(by_alias=True))
        
        # Run agent synchronously (awaiting it)
        await run_firereach_agent(
            new_job.id, 
            request.icp, 
            request.company, 
            request.email
        )
        
        # Fetch final state
        final_state = await get_job_state(new_job.id)
        if not final_state:
            raise HTTPException(status_code=500, detail="Job state lost after execution")
            
        final_state["id"] = str(final_state.pop("_id"))
        return final_state
    except Exception as e:
        import traceback
        print(f"Error in /run-agent: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/jobs/{job_id}", dependencies=[Depends(get_current_user)])
async def get_job(job_id: str):
    job = await get_job_state(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job["id"] = job.pop("_id")
    return job


@app.get("/api/jobs", dependencies=[Depends(get_current_user)])
async def list_jobs():
    cursor = jobs_collection.find().sort("created_at", -1)
    jobs = await cursor.to_list(length=100)
    for j in jobs:
        j["id"] = j.pop("_id")
    return jobs

@app.get("/api/leads", dependencies=[Depends(get_current_user)])
async def list_leads():
    # Only return jobs that actively discovered an email target
    cursor = jobs_collection.find({"target_email": {"$ne": None}}).sort("created_at", -1)
    leads = await cursor.to_list(length=200)
    for l in leads:
        l["id"] = l.pop("_id")
    return leads

@app.delete("/api/leads/{lead_id}", dependencies=[Depends(get_current_user)])
async def delete_lead(lead_id: str):
    res = await jobs_collection.delete_one({"_id": lead_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"status": "deleted"}

class BulkApproveRequest(BaseModel):
    lead_ids: List[str]

@app.post("/api/leads/bulk/approve", dependencies=[Depends(get_current_user)])
async def bulk_approve_leads(req: BulkApproveRequest, background_tasks: BackgroundTasks):
    # This just triggers the send_email logic for multiple leads using their saved drafts
    count = 0
    for lid in req.lead_ids:
        job = await get_job_state(lid)
        if job and job.get("status") == "pending_approval" and job.get("email_draft"):
            # Reuse the existing approve_job logic but in a loop
            # For bulk, we don't want to await each network call individually if there are many
            background_tasks.add_task(approve_job, lid, ApproveRequest(email_draft=job.get("email_draft")))
            count += 1
    return {"status": "processing", "count": count}



class ApproveRequest(BaseModel):
    email_draft: Optional[str] = None

@app.post("/api/jobs/{job_id}/approve", dependencies=[Depends(get_current_user)])
async def approve_job(job_id: str, req: ApproveRequest):
    job = await get_job_state(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.get("status") not in ["pending_approval", "generating_draft"]: # allowing generating_draft just in case
        pass # allow resending for now
    
    final_draft = req.email_draft if req.email_draft else job.get("email_draft")
    target_email = job.get("target_email")
    company = job.get("target_company") or "Company"
    
    if not target_email:
        raise HTTPException(status_code=400, detail="No target email found for this job")
        
    # Extract subject
    subject = f"Outreach for {company}"
    if final_draft and "Subject:" in final_draft:
        for line in final_draft.split('\n'):
            if line.startswith("Subject:"):
                subject = line.replace("Subject:", "").strip()
                final_draft = final_draft.replace(line, "").strip() # Remove subject from body
                break

    try:
        send_email(target_email, subject, final_draft)
        await update_job_state(job_id, {"status": "sent", "email_draft": final_draft})
        return {"status": "sent"}
    except Exception as e:
        await update_job_state(job_id, {"status": "failed"})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats", dependencies=[Depends(get_current_user)])
async def get_stats():
    try:
        total_leads = await jobs_collection.count_documents({"target_email": {"$ne": None}})
        emails_sent = await jobs_collection.count_documents({"status": "sent"})
        pending_approval = await jobs_collection.count_documents({"status": "pending_approval"})
        active_campaigns = await campaigns_collection.count_documents({"status": "running"})
        
        return {
            "total_leads": total_leads,
            "emails_sent": emails_sent,
            "pending_approval": pending_approval,
            "active_campaigns": active_campaigns
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/trends", dependencies=[Depends(get_current_user)])
async def get_analytics_trends():
    try:
        from datetime import timedelta
        now = datetime.utcnow()
        days_7_ago = now - timedelta(days=7)
        
        # Aggregate leads (jobs with emails) by day
        cursor = jobs_collection.find({
            "target_email": {"$ne": None},
            "created_at": {"$gte": days_7_ago}
        })
        jobs = await cursor.to_list(length=1000)
        
        # Naive bucketization
        data = {}
        for i in range(8):
            day = (now - timedelta(days=i)).strftime("%b %d")
            data[day] = 0
            
        for j in jobs:
            day = j["created_at"].strftime("%b %d")
            if day in data:
                data[day] += 1
                
        # Format for Recharts: [{name: 'Apr 1', leads: 5}, ...]
        chart_data = [{"name": day, "leads": count} for day, count in reversed(list(data.items()))]
        return chart_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.websocket("/ws/jobs/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await manager.connect(websocket, job_id)
    try:
        while True:
            # We don't really expect frontend to send much, but we need to keep connection open
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(job_id)
