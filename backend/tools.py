from langchain.tools import tool
import os
import requests
import json
from email_service import send_email
from config import settings

run_state = {
    "signals": [],
    "research": "",
    "email": "",
    "target_company": "",
    "target_email": "",
    "lead_name": "",
    "lead_title": "",
    "lead_confidence": 0,
}

def clear_run_state():
    run_state["signals"] = []
    run_state["research"] = ""
    run_state["email"] = ""
    run_state["target_company"] = ""
    run_state["target_email"] = ""
    run_state["lead_name"] = ""
    run_state["lead_title"] = ""
    run_state["lead_confidence"] = 0


# ---------------------------------------------------------------------------
# TOOL 1 — Signal Harvester
# ---------------------------------------------------------------------------

@tool
def tool_signal_harvester(company: str) -> str:
    """
    Fetch live buyer signals about a company.
    Signals to capture: funding rounds, leadership changes, hiring trends,
    tech stack changes, social mentions, product launches, competitor churn.
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
            for item in data['organic'][:3]:
                signals.append(item.get('title', '') + " - " + item.get('snippet', ''))

        if not signals:
            signals = [f"No recent signals found for {company}"]

        run_state["signals"] = signals
        return json.dumps(signals)
    except Exception as e:
        error_msg = [f"Error fetching signals: {str(e)}"]
        run_state["signals"] = error_msg
        return json.dumps(error_msg)


# ---------------------------------------------------------------------------
# TOOL 2 — Research Analyst
# ---------------------------------------------------------------------------

@tool
def tool_research_analyst(signals: str, icp: str) -> str:
    """
    Analyze signals and ICP to generate a 2 paragraph account brief.
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage

    api_key = settings.GROQ_API_KEY
    if not api_key:
        mock_research = (
            f"Analysis of signals based on ICP: {icp}. The company shows strong alignment. "
            "They recently raised funding and are expanding their engineering team. "
            "Rapid engineering growth often introduces security risks, making them a prime candidate."
        )
        run_state["research"] = mock_research
        return mock_research

    try:
        chat = ChatGroq(temperature=0.2, groq_api_key=api_key, model_name="llama-3.1-8b-instant")
        messages = [
            SystemMessage(content=(
                "You are a research analyst. Analyze the given signals and Ideal Customer Profile (ICP) "
                "to generate a 2 paragraph account brief. Include company growth context, potential pain "
                "points, and strategic alignment with ICP. Do not output anything else."
            )),
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


# ---------------------------------------------------------------------------
# TOOL 3 — Outreach Sender
# ---------------------------------------------------------------------------

@tool
def tool_outreach_automated_sender(signals: str, icp: str, company: str, email_address: str) -> str:
    """
    Generate a hyper-personalized outreach email referencing the signals and
    automatically send the email.
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage

    api_key = settings.GROQ_API_KEY
    if not api_key:
        mock_email = (
            f"Subject: Following up on {company}'s recent growth\n\n"
            f"Hi,\n\nI noticed {company} is hiring several backend engineers after recent funding... "
            f"I'd love to discuss how our solutions fit your ICP: {icp}.\n\nBest,\nFireReach Agent"
        )
        run_state["email"] = mock_email
        send_email(email_address, f"Outreach for {company}", mock_email)
        return "Email sent successfully to " + email_address

    try:
        chat = ChatGroq(temperature=0.4, groq_api_key=api_key, model_name="llama-3.1-8b-instant")

        # Build a personalized salutation if we know the lead name
        lead_name = run_state.get("lead_name", "")
        salutation_hint = f"Address the email to {lead_name}." if lead_name else "If you don't know the name, use 'Hi,'."

        messages = [
            SystemMessage(content=(
                "You are an expert sales SDR. Generate a hyper-personalized outreach email referencing "
                "the provided signals. You must explicitly reference signals, never use templates, and "
                "the tone must feel human and natural. Only output the exact email content including Subject.\n\n"
                "CRITICAL: Never use square brackets or placeholders like [Company Name], [Decision Maker], "
                "or [Your Name]. You are writing this for a real person at the Target Company. "
                f"{salutation_hint} "
                "At the end of the email, always sign off exactly as:\n\nBest,\nFireReach Agent"
            )),
            HumanMessage(content=f"Target Company Name: {company}\nSignals: {signals}\nICP: {icp}\n\nWrite the email now.")
        ]

        email_content = chat.invoke(messages).content
        run_state["email"] = email_content

        # Parse subject
        subject = f"Outreach for {company}"
        if "Subject:" in email_content:
            for line in email_content.split('\n'):
                if line.startswith("Subject:"):
                    subject = line.replace("Subject:", "").strip()
                    break

        result = send_email(email_address, subject, email_content)

        run_state["target_company"] = company
        run_state["target_email"] = email_address

        if result.get("status") == "sent":
            return f"Drafted and sent email successfully to {email_address} at {company}."
        elif result.get("status") == "mocked":
            return f"Email was MOCKED (SMTP not configured). Result: {result.get('message')}"
        else:
            return f"Failed to send email: {result.get('message')}"
    except Exception as e:
        error_msg = f"Failed to generate and send email: {str(e)}"
        run_state["email"] = error_msg
        return error_msg


# ---------------------------------------------------------------------------
# TOOL 4 — Company Finder  (returns name + domain)
# ---------------------------------------------------------------------------

@tool
def tool_company_finder(icp: str) -> str:
    """
    Find 3 target companies that perfectly match the described Ideal Customer Profile (ICP).
    Returns a JSON list of objects with 'name' and 'domain' keys.
    Example: [{"name": "Stripe", "domain": "stripe.com"}, ...]
    """
    serper_api_key = settings.SERPER_API_KEY
    if not serper_api_key:
        mock = [
            {"name": "Acme Corp", "domain": "acmecorp.com"},
            {"name": "Globex", "domain": "globex.com"},
            {"name": "Initech", "domain": "initech.com"},
        ]
        return json.dumps(mock)

    url = "https://google.serper.dev/search"
    # More targeted query to surface real company domains
    query = f"top companies that match ideal customer profile: {icp} site:linkedin.com OR crunchbase.com OR techcrunch.com"
    payload = json.dumps({"q": query})
    headers = {
        'X-API-KEY': serper_api_key,
        'Content-Type': 'application/json'
    }

    try:
        response = requests.request("POST", url, headers=headers, data=payload)
        data = response.json()

        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage

        api_key = settings.GROQ_API_KEY
        context = "\n".join([
            f"- {item.get('title')} | URL: {item.get('link')} | {item.get('snippet')}"
            for item in data.get('organic', [])[:6]
        ])

        if not api_key:
            # Fallback: extract from titles only
            companies = [
                {"name": item.get('title', '').split(' - ')[0], "domain": ""}
                for item in data.get('organic', [])[:3]
            ]
            return json.dumps(companies)

        chat = ChatGroq(temperature=0, groq_api_key=api_key, model_name="llama-3.1-8b-instant")
        prompt = (
            f"Based on these search results, identify 3 specific real companies that best match this ICP: {icp}.\n"
            "For each company, provide its exact company name and its primary website domain (e.g. stripe.com).\n"
            "Output ONLY a valid JSON array with NO extra text. Format:\n"
            '[{"name": "Company Name", "domain": "companydomain.com"}, ...]\n\n'
            f"Search Results:\n{context}"
        )

        res = chat.invoke([HumanMessage(content=prompt)])
        content = res.content.strip()
        # Strip markdown code fences if present
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        # Cache the first company name immediately so run_state always has a value
        try:
            first = json.loads(content)
            if isinstance(first, list) and first:
                run_state["target_company"] = first[0].get("name", "")
        except Exception:
            pass

        return content
    except Exception as e:
        return json.dumps([{"name": f"Error finding companies: {str(e)}", "domain": ""}])


# ---------------------------------------------------------------------------
# TOOL 5 — Lead Finder  (uses Hunter.io for REAL verified emails)
# ---------------------------------------------------------------------------

@tool
def tool_lead_finder(company: str, domain: str, icp: str) -> str:
    """
    Find the most reachable decision-maker at a company matching the ICP, 
    then find their real verified email address.
    """
    if company:
        run_state["target_company"] = company

    # Step 1: Use Serper to find the exact right person for the ICP
    serper_api_key = settings.SERPER_API_KEY
    import re
    words = [w for w in re.findall(r'\b\w+\b', icp.lower()) if len(w) > 3 and w not in ["that", "with", "from", "their"]]
    icp_keywords = " ".join(words[:4])

    url = "https://google.serper.dev/search"
    payload = json.dumps({
        "q": f"{company} (CTO OR VP OR Director OR Head OR Founder) {icp_keywords} LinkedIn profile"
    })
    headers = {
        'X-API-KEY': serper_api_key,
        'Content-Type': 'application/json'
    }

    try:
        r = requests.request("POST", url, headers=headers, data=payload)
        serper_data = r.json()
    except Exception as e:
        serper_data = {"organic": []}

    # Extract name and title using LLM
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage
    api_key = settings.GROQ_API_KEY
    
    if not api_key:
        return json.dumps({"error": "GROQ_API_KEY is missing."})

    chat = ChatGroq(temperature=0, groq_api_key=api_key, model_name="llama-3.1-8b-instant")
    context = "\\n".join([
        f"- {item.get('title')} : {item.get('snippet')}"
        for item in serper_data.get('organic', [])[:5]
    ])

    prompt = (
        f"From these search results, find the name and job title of a real senior executive at {company} "
        f"matching the ICP focus: {icp_keywords}.\n"
        "Output ONLY a valid JSON object with NO extra text in this EXACT format:\n"
        '{"first_name": "John", "last_name": "Doe", "title": "Job Title"}\n\n'
        f"Search Results:\n{context}"
    )

    try:
        res = chat.invoke([HumanMessage(content=prompt)])
        content = res.content.strip()
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        
        parsed = json.loads(content)
        first_name = parsed.get("first_name", "Unknown")
        last_name = parsed.get("last_name", "")
        full_name = f"{first_name} {last_name}".strip()
        title = parsed.get("title", "Decision Maker")
    except Exception:
        first_name, last_name, full_name, title = "John", "Doe", "John Doe", "Executive"

    run_state["lead_name"] = full_name
    run_state["lead_title"] = title

    # Step 2: Use Hunter.io to find the specific person's email
    hunter_key = settings.HUNTER_API_KEY
    email, confidence, source = "", 0, ""

    if hunter_key and domain and first_name != "Unknown":
        try:
            hunter_url = "https://api.hunter.io/v2/email-finder"
            params = {
                "domain": domain,
                "first_name": first_name,
                "last_name": last_name,
                "api_key": hunter_key
            }
            hunter_req = requests.get(hunter_url, params=params, timeout=10)
            h_data = hunter_req.json()

            if h_data.get("data") and h_data["data"].get("email"):
                email = h_data["data"]["email"]
                confidence = h_data["data"].get("score", 90)
                source = "hunter.io (email-finder)"
        except Exception as e:
            print(f"Hunter Email Finder failed: {e}")

    # Step 3: Fallback to Hunter.io Domain Search (find ANY verified executive)
    if not email and hunter_key and domain:
        try:
            domain_url = "https://api.hunter.io/v2/domain-search"
            d_params = {
                "domain": domain,
                "api_key": hunter_key,
                "limit": 10,
                "type": "personal",
            }
            d_req = requests.get(domain_url, params=d_params, timeout=10)
            d_data = d_req.json()
            contacts = d_data.get("data", {}).get("emails", [])
            
            if contacts:
                icp_lower = icp.lower()
                priority_keywords = ["cto", "vp", "ceo", "ciso", "head of", "director", "engineering", "security", "product", "founder", "chief"]

                def score_contact(c):
                    t = (c.get("position") or "").lower()
                    conf = c.get("confidence") or 0
                    role_score = sum(1 for kw in priority_keywords if kw in t)
                    icp_match = sum(1 for kw in t.split() if kw in icp_lower)
                    return conf + role_score * 10 + icp_match * 5

                best = max(contacts, key=score_contact)
                name_parts = [best.get("first_name", ""), best.get("last_name", "")]
                full_name = " ".join(p for p in name_parts if p).strip() or "Unknown"
                title = best.get("position") or "Decision Maker"
                email = best.get("value", "")
                confidence = best.get("confidence", 0)
                source = "hunter.io (domain-search fallback)"
                
                run_state["lead_name"] = full_name
                run_state["lead_title"] = title
        except Exception as e:
            print(f"Hunter Domain Search failed: {e}")

    # Step 4: If still no email, stop here to strictly prevent bounces
    if not email:
         return json.dumps({
            "error": f"Could not find any highly verified email address for executives at {company}. Aborting to prevent reputation damage/bounces."
         })

    run_state["target_email"] = email
    run_state["lead_confidence"] = confidence

    return json.dumps({
        "name": full_name,
        "title": title,
        "email": email,
        "confidence": confidence,
        "source": source
    })
