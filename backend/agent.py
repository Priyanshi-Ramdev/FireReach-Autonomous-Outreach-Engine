from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from prompts import SYSTEM_PROMPT
from tools import (
    tool_signal_harvester,
    tool_research_analyst,
    tool_outreach_automated_sender,
    tool_company_finder,
    tool_lead_finder,
    clear_run_state,
    run_state
)
from config import settings
import json


def run_firereach_agent(icp: str, company: str = None, email: str = None):
    clear_run_state()

    api_key = settings.GROQ_API_KEY
    if not api_key:
        print("MOCK MODE: No GROQ_API_KEY found, running mock agent...")
        tool_signal_harvester.invoke({"company": company or "Mock Company"})
        tool_research_analyst.invoke({"signals": str(run_state["signals"]), "icp": icp})
        tool_outreach_automated_sender.invoke({
            "signals": str(run_state["signals"]),
            "icp": icp,
            "company": company or "Mock Company",
            "email_address": email or "mock@example.com"
        })
        return run_state

    # Initialize LLM
    llm = ChatGroq(temperature=0, groq_api_key=api_key, model_name="llama-3.3-70b-versatile")

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
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True, max_iterations=15)

    # Build the input — ICP is always required; company and email are optional
    input_parts = [f"ICP: '{icp}'"]
    if company:
        input_parts.append(f"Company: {company}")
    if email:
        input_parts.append(f"Target Email: {email}")

    input_text = f"Execute the outreach workflow. Details: {', '.join(input_parts)}."

    try:
        agent_executor.invoke({"input": input_text})
    except Exception as e:
        import traceback
        import json
        with open("error_trace.json", "w") as f:
            json.dump({"trace": traceback.format_exc(), "error": str(e)}, f)
        print(f"Agent execution encountered an error: {e}")

    return run_state
