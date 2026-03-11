from langchain.tools import tool
import os
import requests
import json
from email_service import send_email
from config import settings

run_state = {
    "signals": [],
    "research": "",
    "email": ""
}

def clear_run_state():
    run_state["signals"] = []
    run_state["research"] = ""
    run_state["email"] = ""

@tool
def tool_signal_harvester(company: str) -> str:
    """
    Fetch live buyer signals about a company.
    Signals to capture: funding rounds, leadership changes, hiring trends, tech stack changes, social mentions, product launches, competitor churn.
    """
    serper_api_key = settings.SERPER_API_KEY
    if not serper_api_key:
        mock_signals = [
            f"{company} raises Series C funding",
            f"{company} hiring 15 backend engineers",
            f"{company} launches new API product"
        ]
        run_state["signals"] = mock_signals
        return json.dumps(mock_signals)

    url = "https://google.serper.dev/search"
    payload = json.dumps({
      "q": f"{company} funding OR hiring OR leadership OR product launch OR tech stack news"
    })
    headers = {
      'X-API-KEY': serper_api_key,
      'Content-Type': 'application/json'
    }
    
    try:
        response = requests.request("POST", url, headers=headers, data=payload)
        data = response.json()
        
        signals = []
        if 'organic' in data:
            for item in data['organic'][:3]: # Get top 3 news/signals
                signals.append(item.get('title', '') + " - " + item.get('snippet', ''))
        
        if not signals:
            signals = [f"No recent signals found for {company}"]
            
        run_state["signals"] = signals
        return json.dumps(signals)
    except Exception as e:
        error_msg = [f"Error fetching signals: {str(e)}"]
        run_state["signals"] = error_msg
        return json.dumps(error_msg)


@tool
def tool_research_analyst(signals: str, icp: str) -> str:
    """
    Analyze signals and ICP to generate a 2 paragraph account brief.
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage
    
    api_key = settings.GROQ_API_KEY
    if not api_key:
        mock_research = f"Analysis of signals based on ICP: {icp}. The company shows strong alignment. They recently raised funding and are expanding their engineering team. Rapid engineering growth often introduces security risks, making them a prime candidate."
        run_state["research"] = mock_research
        return mock_research
        
    try:
        chat = ChatGroq(temperature=0.2, groq_api_key=api_key, model_name="llama-3.1-8b-instant")
        messages = [
            SystemMessage(content="You are a research analyst. Analyze the given signals and Ideal Customer Profile (ICP) to generate a 2 paragraph account brief. Include company growth context, potential pain points, and strategic alignment with ICP. Do not output anything else."),
            HumanMessage(content=f"Signals: {signals}\n\nICP: {icp}")
        ]
        response = chat.invoke(messages)
        research = response.content
        run_state["research"] = research
        return research
    except Exception as e:
        error_research = f"Failed to generate research: {str(e)}"
        run_state["research"] = error_research
        return error_research


@tool
def tool_outreach_automated_sender(signals: str, icp: str, company: str, email_address: str) -> str:
    """
    Generate a hyper-personalized outreach email referencing the signals and automatically send the email.
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage
    
    api_key = settings.GROQ_API_KEY
    if not api_key:
        mock_email = f"Subject: Following up on {company}'s recent growth\n\nHi,\n\nI noticed {company} is hiring several backend engineers after recent funding... I'd love to discuss how our solutions fit your ICP: {icp}.\n\nBest,\nFireReach Agent"
        run_state["email"] = mock_email
        send_email(email_address, f"Outreach for {company}", mock_email)
        return "Email sent successfully to " + email_address
        
    try:
        chat = ChatGroq(temperature=0.4, groq_api_key=api_key, model_name="llama-3.1-8b-instant")
        messages = [
            SystemMessage(content="You are an expert sales SDR. Generate a hyper-personalized outreach email referencing the provided signals. You must explicitly reference signals, never use templates, and the tone must feel human and natural. Only output the exact email content including Subject.\n\nCRITICAL: Never use square brackets or placeholders like [Company Name], [Decision Maker], or [Your Name]. You are writing this for a real person at the Target Company. If you don't know a name, use 'Hi,'. At the end of the email, always sign off exactly as:\n\nBest,\nFireReach Agent"),
            HumanMessage(content=f"Target Company Name: {company}\nSignals: {signals}\nICP: {icp}\n\nWrite the email now.")
        ]
        
        email_content = chat.invoke(messages).content
        run_state["email"] = email_content
        
        # Parse subject if possible, or use a default
        subject = f"Outreach for {company}"
        if "Subject:" in email_content:
            lines = email_content.split('\n')
            for line in lines:
                if line.startswith("Subject:"):
                    subject = line.replace("Subject:", "").strip()
                    break
                    
        send_email(email_address, subject, email_content)
        
        return f"Drafted and sent email successfully to {email_address}."
    except Exception as e:
        error_msg = f"Failed to generate and send email: {str(e)}"
        run_state["email"] = error_msg
        return error_msg
