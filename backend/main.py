from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import run_firereach_agent
from typing import Optional

app = FastAPI(title="FireReach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentRequest(BaseModel):
    icp: str                        # Required — the only mandatory field
    company: Optional[str] = None   # Optional — agent auto-finds if not provided
    email: Optional[str] = None     # Optional — agent auto-finds via Hunter.io if not provided


class AgentResponse(BaseModel):
    signals: list[str]
    research: str
    email: str
    target_email: Optional[str] = None
    target_company: Optional[str] = None
    lead_name: Optional[str] = None
    lead_title: Optional[str] = None
    lead_confidence: Optional[int] = None


@app.post("/run-agent", response_model=AgentResponse)
async def run_agent(request: AgentRequest):
    try:
        result = run_firereach_agent(
            icp=request.icp,
            company=request.company,
            email=request.email
        )
        # target_company and target_email are set by tools as they run;
        # fall back to request values only as a last resort
        return AgentResponse(
            signals=result.get("signals", []),
            research=result.get("research", ""),
            email=result.get("email", ""),
            target_email=result.get("target_email") or request.email,
            target_company=result.get("target_company") or request.company,
            lead_name=result.get("lead_name") or None,
            lead_title=result.get("lead_title") or None,
            lead_confidence=result.get("lead_confidence") if result.get("lead_confidence") is not None else None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "ok"}
