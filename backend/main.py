from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import run_firereach_agent

app = FastAPI(title="FireReach API")

# Setup CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust as needed in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AgentRequest(BaseModel):
    company: str
    icp: str
    email: str

class AgentResponse(BaseModel):
    signals: list[str]
    research: str
    email: str
    target_email: str = None

@app.post("/run-agent", response_model=AgentResponse)
async def run_agent(request: AgentRequest):
    try:
        result = run_firereach_agent(
            company=request.company,
            icp=request.icp,
            email=request.email
        )
        return AgentResponse(
            signals=result.get("signals", []),
            research=result.get("research", ""),
            email=result.get("email", ""),
            target_email=result.get("target_email", request.email)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok"}
