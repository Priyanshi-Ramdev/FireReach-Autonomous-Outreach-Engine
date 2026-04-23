from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

class JobState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    icp: str
    company_input: Optional[str] = None
    email_input: Optional[str] = None
    
    status: str = "pending" # pending, processing, generating_draft, pending_approval, sent, failed
    signals: List[str] = []
    research: str = ""
    email_draft: str = ""
    
    target_company: Optional[str] = None
    target_email: Optional[str] = None
    lead_name: Optional[str] = None
    lead_title: Optional[str] = None
    lead_confidence: Optional[int] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CampaignState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    name: str = "New Campaign"
    icp: str
    target_count: int = 5
    status: str = "running" # running, completed, failed
    job_ids: List[str] = []
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class WorkspaceSettings(BaseModel):
    id: str = "default_settings"
    persona_prompt: str = "You are an expert sales SDR. Tone: Natural, Human, Professional. Constraint: Under 150 words."
    groq_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    serper_api_key: Optional[str] = None
    hunter_api_key: Optional[str] = None
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    sender_email: str = "FireReach Agent <agent@tryfirereach.com>"

class WorkspaceTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    name: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

