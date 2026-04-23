from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.callbacks import AsyncCallbackHandler
from config import settings
from websocket_manager import manager
import asyncio

class AgentThoughtHandler(AsyncCallbackHandler):
    def __init__(self, job_id: str):
        self.job_id = job_id

    async def on_agent_action(self, action, **kwargs):
        # Stream the thought/action to the frontend
        thought = f"Agent Action: {action.tool} with input {action.tool_input}"
        await manager.send_updates(self.job_id, {"event": "job_update", "updates": {"status": f"AI: {action.tool.replace('_', ' ')}", "thought": thought}})

async def get_llm(ws_settings: dict, model_type="versatile"):
    groq_key = ws_settings.get("groq_api_key") or settings.GROQ_API_KEY
    gemini_key = ws_settings.get("google_api_key") or settings.GOOGLE_API_KEY
    
    groq_llm = None
    gemini_llm = None
    
    if groq_key:
        model_name = "llama-3.3-70b-versatile" if model_type == "versatile" else "llama-3.1-8b-instant"
        groq_llm = ChatGroq(temperature=0, groq_api_key=groq_key, model_name=model_name, timeout=15)
            
    if gemini_key:
        gemini_llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=gemini_key, temperature=0, timeout=15)
    
    # Return a dictionary for the direct resilient_ainvoke callers
    llm_dict = {"groq": groq_llm, "gemini": gemini_llm}
    
    # Also return a fallback chain for the AgentExecutor
    if groq_llm and gemini_llm:
        return groq_llm.with_fallbacks([gemini_llm]), llm_dict
    elif groq_llm:
        return groq_llm, llm_dict
    elif gemini_llm:
        return gemini_llm, llm_dict
    
    return None, llm_dict

async def resilient_ainvoke(llms: dict, messages: list, job_id: str = None):
    """
    Tries Groq first, then falls back to Gemini if Groq fails or times out.
    """
    # 1. Try Groq
    if llms.get("groq"):
        try:
            return await llms["groq"].ainvoke(messages)
        except Exception as e:
            msg = f"Groq primary failed, attempting Gemini fallback... (Error: {str(e)[:50]})"
            print(msg)
            if job_id:
                await manager.send_updates(job_id, {"event": "job_update", "updates": {"thought": msg}})
    
    # 2. Try Gemini
    if llms.get("gemini"):
        try:
            return await llms["gemini"].ainvoke(messages)
        except Exception as e:
            msg = f"Gemini fallback also failed: {str(e)[:50]}"
            print(msg)
            if job_id:
                await manager.send_updates(job_id, {"event": "job_update", "updates": {"status": "failed", "thought": msg}})
            raise e
            
    # 3. No keys found
    error_msg = "No operational AI keys found (Groq/Gemini). Please check Settings."
    if job_id:
        await manager.send_updates(job_id, {"event": "job_update", "updates": {"status": "failed", "thought": error_msg}})
    raise Exception(error_msg)

async def resilient_astream(llms: dict, messages: list, job_id: str):
    """
    Streams content from the LLM and sends chunks to the frontend via WebSocket.
    """
    full_content = ""
    
    # helper to process stream
    async def process_stream(llm_instance):
        nonlocal full_content
        async for chunk in llm_instance.astream(messages):
            content = chunk.content if hasattr(chunk, 'content') else str(chunk)
            full_content += content
            await manager.send_updates(job_id, {
                "event": "draft_chunk",
                "chunk": content
            })
        return full_content

    # 1. Try Groq
    if llms.get("groq"):
        try:
            return await process_stream(llms["groq"])
        except Exception as e:
            msg = f"Groq stream failed, attempting Gemini fallback... (Error: {str(e)[:50]})"
            print(msg)
            full_content = "" # reset for retry
            await manager.send_updates(job_id, {"event": "job_update", "updates": {"thought": msg}})
    
    # 2. Try Gemini
    if llms.get("gemini"):
        try:
            return await process_stream(llms["gemini"])
        except Exception as e:
            msg = f"Gemini fallback stream also failed: {str(e)[:50]}"
            print(msg)
            await manager.send_updates(job_id, {"event": "job_update", "updates": {"status": "failed", "thought": msg}})
            raise e
            
    raise Exception("No operational AI keys found for streaming.")
