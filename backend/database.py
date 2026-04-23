from motor.motor_asyncio import AsyncIOMotorClient
import os
import contextvars
import asyncio
import logging

logger = logging.getLogger(__name__)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

# If MONGO_URI is set to something other than localhost default, try to connect
# Otherwise fallback to mongomock safely to prevent Windows socket deadlocks
if "localhost:27017" not in MONGO_URI:
    logger.info(f"Connecting to live MongoDB at {MONGO_URI}...")
    client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=2000)
else:
    logger.warning(f"MongoDB not configured. Falling back to mongomock (in-memory) to prevent crash.")
    from mongomock_motor import AsyncMongoMockClient as MockAsyncIOMotorClient
    client = MockAsyncIOMotorClient()

db = client.firereach_db
jobs_collection = db.get_collection("jobs")
campaigns_collection = db.get_collection("campaigns")
settings_collection = db.get_collection("settings")
templates_collection = db.get_collection("templates")


current_job_id = contextvars.ContextVar('current_job_id', default=None)

async def get_workspace_settings():
    settings = await settings_collection.find_one({"_id": "default_settings"})
    if not settings:
        # Create default from env if not in DB
        from models import WorkspaceSettings
        default = WorkspaceSettings(
            groq_api_key=os.getenv("GROQ_API_KEY"),
            serper_api_key=os.getenv("SERPER_API_KEY"),
            hunter_api_key=os.getenv("HUNTER_API_KEY"),
            smtp_user=os.getenv("SMTP_USER", ""),
            smtp_password=os.getenv("SMTP_PASSWORD", "")
        )
        await settings_collection.insert_one(default.dict(by_alias=True))
        return default.dict(by_alias=True)
    return settings

async def update_workspace_settings(updates: dict):
    await settings_collection.update_one({"_id": "default_settings"}, {"$set": updates}, upsert=True)


async def get_db():
    return db

async def update_job_state(job_id: str, updates: dict):
    if not job_id:
        return
    await jobs_collection.update_one({"_id": job_id}, {"$set": updates})
    
    # Broadcast to frontend via websockets
    try:
        from websocket_manager import manager
        await manager.send_updates(job_id, {"event": "job_update", "updates": updates})
    except Exception as e:
        logger.error(f"Failed to broadcast ws: {e}")

async def get_job_state(job_id: str):
    if not job_id:
        return {}
    return await jobs_collection.find_one({"_id": job_id})

async def update_campaign_state(campaign_id: str, updates: dict):
    if not campaign_id:
        return
    await campaigns_collection.update_one({"_id": campaign_id}, {"$set": updates})

async def get_campaign_state(campaign_id: str):
    if not campaign_id:
        return {}
    return await campaigns_collection.find_one({"_id": campaign_id})

async def add_job_to_campaign(campaign_id: str, job_id: str):
    if not campaign_id or not job_id:
        return
    await campaigns_collection.update_one({"_id": campaign_id}, {"$push": {"job_ids": job_id}})

