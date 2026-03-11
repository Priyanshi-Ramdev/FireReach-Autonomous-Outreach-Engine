from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from prompts import SYSTEM_PROMPT
from tools import tool_signal_harvester, tool_research_analyst, tool_outreach_automated_sender, clear_run_state, run_state
from config import settings
import os

def run_firereach_agent(company: str, icp: str, email: str):
    clear_run_state()
    
    api_key = settings.GROQ_API_KEY
    if not api_key:
        print("MOCK MODE: No GROQ_API_KEY found, running mock agent...")
        tool_signal_harvester.invoke({"company": company})
        tool_research_analyst.invoke({"signals": str(run_state["signals"]), "icp": icp})
        tool_outreach_automated_sender.invoke({"signals": str(run_state["signals"]), "icp": icp, "company": company, "email_address": email})
        return run_state

    # Initialize LLM
    llm = ChatGroq(temperature=0, groq_api_key=api_key, model_name="llama-3.3-70b-versatile")
    
    tools = [tool_signal_harvester, tool_research_analyst, tool_outreach_automated_sender]
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])
    
    agent = create_tool_calling_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True, max_iterations=5)
    
    input_text = f"Execute the outreach workflow for Company: {company}. The ICP is '{icp}'. The target email is '{email}'."
    
    try:
        agent_executor.invoke({"input": input_text})
    except Exception as e:
        print(f"Agent execution encountered an error: {e}")
        
    run_state["target_email"] = email
    return run_state
