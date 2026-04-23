from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.callbacks import AsyncCallbackHandler
from prompts import SYSTEM_PROMPT
from tools import (
    tool_signal_harvester,
    tool_research_analyst,
    tool_outreach_automated_sender,
    tool_company_finder,
    tool_lead_finder
)
from database import current_job_id, update_job_state, get_job_state, get_workspace_settings
from config import settings
from websocket_manager import manager
from llm_factory import get_llm, AgentThoughtHandler
import json
import asyncio

async def run_firereach_agent(job_id: str, icp: str, company: str = None, email: str = None):
    # Set the ContextVar for this async run
    current_job_id.set(job_id)
    
    await update_job_state(job_id, {"status": "processing"})
    
    # Load dynamic workspace settings
    ws_settings = await get_workspace_settings()
    llm, _ = await get_llm(ws_settings) # We use the fallback-enabled chain for the agent loop
    
    if not llm:
        print("MOCK MODE: No API Keys found, running mock agent...")
        await asyncio.sleep(2)
        await update_job_state(job_id, {"status": "pending_approval", "email_draft": "Subject: Growth at [Company]\n\nHi [Name],\n\nI noticed [Signal]. Let's chat."})
        await manager.send_updates(job_id, {"event": "job_update", "updates": {"status": "pending_approval"}})
        return

    tools = [
        tool_company_finder,
        tool_lead_finder,
        tool_signal_harvester,
        tool_research_analyst,
        tool_outreach_automated_sender
    ]

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_tool_calling_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(
        agent=agent, 
        tools=tools, 
        verbose=True, 
        max_iterations=15,
        callbacks=[AgentThoughtHandler(job_id)]
    )

    # Build the input
    input_parts = [f"ICP: '{icp}'"]
    if company:
        input_parts.append(f"Company: {company}")
    if email:
        input_parts.append(f"Target Email: {email}")

    input_text = f"Execute the outreach workflow. Details: {', '.join(input_parts)}."

    try:
        await agent_executor.ainvoke({"input": input_text})
    except Exception as e:
        import traceback
        with open("error_trace.json", "w") as f:
            json.dump({"trace": traceback.format_exc(), "error": str(e)}, f)
        print(f"Agent execution encountered an error: {e}")
        await update_job_state(job_id, {"status": "failed"})
        await manager.send_updates(job_id, {"event": "job_update", "updates": {"status": "failed", "error": str(e)}})

