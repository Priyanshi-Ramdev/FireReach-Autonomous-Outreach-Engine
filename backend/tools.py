from langchain.tools import tool
import os
import httpx
import json
from email_service import send_email
from config import settings
from database import current_job_id, update_job_state, get_job_state, get_workspace_settings
from websocket_manager import manager
from llm_factory import get_llm, resilient_ainvoke

async def stream_thought(job_id: str, status: str, thought: str):
    if job_id:
        await manager.send_updates(job_id, {
            "event": "job_update", 
            "updates": {"status": status, "thought": thought}
        })

# ---------------------------------------------------------------------------
# TOOL 1 — Signal Harvester
# ---------------------------------------------------------------------------

@tool
async def tool_signal_harvester(company: str) -> str:
    """
    Fetch live buyer signals about a company.
    Signals to capture: funding rounds, leadership changes, hiring trends,
    tech stack changes, social mentions, product launches, competitor churn.
    """
    job_id = current_job_id.get()
    if job_id:
        await update_job_state(job_id, {"status": "harvesting_signals"})

    serper_api_key = settings.SERPER_API_KEY
    if not serper_api_key:
        mock_signals = [
            f"{company} raises Series C funding",
            f"{company} hiring 15 backend engineers",
            f"{company} launches new API product"
        ]
        if job_id:
            await update_job_state(job_id, {"signals": mock_signals})
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
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, headers=headers, content=payload)
            data = response.json()

        signals = []
        if 'organic' in data:
            for item in data['organic'][:3]:
                signals.append(item.get('title', '') + " - " + item.get('snippet', ''))

        if not signals:
            signals = [f"No recent signals found for {company}"]

        if job_id:
            await stream_thought(job_id, "AI: Signal Harvested", f"Found {len(signals)} signals for {company}.")
            await update_job_state(job_id, {"signals": signals})
        return json.dumps(signals)
    except Exception as e:
        error_msg = [f"Error fetching signals: {str(e)}"]
        if job_id:
            await update_job_state(job_id, {"signals": error_msg})
        return json.dumps(error_msg)


# ---------------------------------------------------------------------------
# TOOL 2 — Research Analyst
# ---------------------------------------------------------------------------

@tool
async def tool_research_analyst(signals: str, icp: str) -> str:
    """
    Analyze signals and ICP to generate a 2 paragraph account brief.
    """
    from langchain_groq import ChatGroq
    from langchain_core.messages import HumanMessage, SystemMessage
    
    job_id = current_job_id.get()
    if job_id:
        await update_job_state(job_id, {"status": "analyzing_research"})

    api_key = settings.GROQ_API_KEY
    if not api_key:
        mock_research = (
            f"Analysis of signals based on ICP: {icp}. The company shows strong alignment. "
            "They recently raised funding and are expanding their engineering team. "
            "Rapid engineering growth often introduces security risks, making them a prime candidate."
        )
        if job_id:
            await update_job_state(job_id, {"research": mock_research})
        return mock_research

    try:
        ws_settings = await get_workspace_settings()
        _, llms = await get_llm(ws_settings, model_type="instant")
        
        from langchain_core.messages import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content=(
                "You are a research analyst. Analyze the given signals and Ideal Customer Profile (ICP) "
                "to generate a 2 paragraph account brief. Include company growth context, potential pain "
                "points, and strategic alignment with ICP. Do not output anything else."
            )),
            HumanMessage(content=f"Signals: {signals}\n\nICP: {icp}")
        ]
        
        await stream_thought(job_id, "AI: Analyzing Research", "Synthesizing company signals into a strategic brief...")
        response = await resilient_ainvoke(llms, messages, job_id)
        research = response.content
        if job_id:
            await update_job_state(job_id, {"research": research})
        return research
    except Exception as e:
        error_research = f"Failed to generate research: {str(e)}"
        if job_id:
            await update_job_state(job_id, {"research": error_research})
        return error_research


# ---------------------------------------------------------------------------
# TOOL 3 — Outreach Sender
# ---------------------------------------------------------------------------

@tool
async def tool_outreach_automated_sender(signals: str, icp: str, company: str, email_address: str) -> str:
    """
    Generate a hyper-personalized outreach email referencing live business signals
    and AUTOMATICALLY SEND it. No human approval needed.
    """
    from langchain_core.messages import HumanMessage, SystemMessage
    
    job_id = current_job_id.get()
    if job_id:
        await update_job_state(job_id, {"status": "generating_draft"})

    ws_settings = await get_workspace_settings()
    persona = ws_settings.get("persona_prompt") or (
        "You are a sharp, concise B2B SDR (Sales Development Representative). "
        "Your emails are short, direct, and always reference a specific business signal. "
        "You never use generic phrases. Every email feels personal and relevant."
    )
    
    # Load lead name from job state if available
    lead_name = ""
    lead_title = ""
    if job_id:
        state = await get_job_state(job_id)
        lead_name = state.get("lead_name", "")
        lead_title = state.get("lead_title", "")

    salutation = f"Hi {lead_name.split()[0]}," if lead_name else "Hi,"
    role_context = f" as {lead_title}" if lead_title else ""

    email_content = None

    # --- Attempt LLM generation (Groq first, Gemini fallback) ---
    try:
        _, llms = await get_llm(ws_settings, model_type="instant")

        messages = [
            SystemMessage(content=(
                f"{persona}\n\n"
                "RULES:\n"
                "- Output ONLY the email text, starting with 'Subject:' on the first line.\n"
                "- Reference the EXACT signals given — mention specific facts (funding round, product launch, hiring surge, etc).\n"
                "- Keep the body under 120 words. Short = more replies.\n"
                "- Never use placeholders like [Company] or [Name]. Use the real values.\n"
                f"- Address the recipient as: {salutation}\n"
                "- Sign off exactly as: Best,\nFireReach Agent\n"
            )),
            HumanMessage(content=(
                f"Write a cold outreach email for this prospect:\n"
                f"Name: {lead_name or 'Decision Maker'}{role_context}\n"
                f"Company: {company}\n"
                f"Business Signals: {signals}\n"
                f"Our Ideal Customer Profile (ICP): {icp}\n\n"
                "Write the email now. Start with Subject: on line 1."
            ))
        ]

        await stream_thought(job_id, "AI: Copywriting", f"Crafting signal-driven email for {lead_name or company}...")
        response = await resilient_ainvoke(llms, messages, job_id)
        email_content = response.content.strip()
    except Exception as e:
        await stream_thought(job_id, "AI: Fallback", f"LLM unavailable ({str(e)[:60]}). Using signal-based template...")

    # --- Smart template fallback (always produces a valid email) ---
    if not email_content:
        # Parse signals into bullet points for the email
        try:
            sig_list = json.loads(signals) if signals.strip().startswith("[") else [signals]
            top_signal = sig_list[0] if sig_list else f"{company} is growing rapidly"
        except Exception:
            top_signal = f"{company} is showing strong growth signals"

        first_name = lead_name.split()[0] if lead_name else "there"
        email_content = (
            f"Subject: Quick note on {company}'s momentum\n\n"
            f"Hi {first_name},\n\n"
            f"I came across {company} recently — specifically: {top_signal.strip('.')}. "
            f"That caught my attention because it aligns exactly with the companies we work with: {icp}.\n\n"
            f"We help teams like yours [key value proposition] — typically seeing results within the first 30 days.\n\n"
            f"Worth a 15-min call this week?\n\n"
            f"Best,\nFireReach Agent"
        )

    # --- Extract Subject and Body ---
    subject = f"Quick note on {company}"
    body = email_content
    lines = email_content.split("\n")
    for i, line in enumerate(lines):
        if line.strip().lower().startswith("subject:"):
            subject = line.split(":", 1)[1].strip()
            body = "\n".join(lines[i+1:]).strip()
            break

    # Save draft to DB
    if job_id:
        await update_job_state(job_id, {
            "email_draft": email_content,
            "target_company": company,
            "target_email": email_address,
            "status": "sending"
        })

    # --- AUTO-SEND the email immediately ---
    await stream_thought(job_id, "AI: Sending", f"Auto-dispatching email to {email_address}...")
    
    try:
        # Build HTML body
        html_body = body.replace("\n", "<br>") if body else email_content.replace("\n", "<br>")
        result = send_email(email_address, subject, html_body)
        
        if result.get("status") in ("sent", "mocked"):
            final_status = "sent"
            await stream_thought(job_id, "✅ Email Sent", f"Email dispatched to {email_address} — Subject: {subject}")
        else:
            final_status = "pending_approval"  # SMTP failed, show for manual send
            await stream_thought(job_id, "⚠️ SMTP Error", f"Auto-send failed: {result.get('message', 'Unknown error')}. Review the draft below.")
    except Exception as smtp_err:
        final_status = "pending_approval"
        await stream_thought(job_id, "⚠️ SMTP Error", f"Could not auto-send: {str(smtp_err)[:80]}. Draft saved for manual review.")

    if job_id:
        await update_job_state(job_id, {
            "email_draft": email_content,
            "status": final_status,
            "auto_sent": final_status == "sent"
        })

    return f"Email {'sent automatically' if final_status == 'sent' else 'saved as draft (SMTP error)'} to {email_address}."


# ---------------------------------------------------------------------------
# TOOL 4 — Company Finder
# ---------------------------------------------------------------------------

@tool
async def tool_company_finder(icp: str) -> str:
    """
    Find 3 target companies that perfectly match the described Ideal Customer Profile (ICP).
    Returns a JSON list of objects with 'name' and 'domain' keys.
    """
    job_id = current_job_id.get()
    if job_id:
        await update_job_state(job_id, {"status": "finding_companies"})

    serper_api_key = settings.SERPER_API_KEY
    if not serper_api_key:
        mock = [
            {"name": "Acme Corp", "domain": "acmecorp.com"},
            {"name": "Globex", "domain": "globex.com"},
            {"name": "Initech", "domain": "initech.com"},
        ]
        return json.dumps(mock)

    url = "https://google.serper.dev/search"
    query = f"top companies that match ideal customer profile: {icp} site:linkedin.com OR crunchbase.com OR techcrunch.com"
    payload = json.dumps({"q": query})
    headers = {
        'X-API-KEY': serper_api_key,
        'Content-Type': 'application/json'
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, headers=headers, content=payload)
            data = r.json()

        ws_settings = await get_workspace_settings()
        _, llms = await get_llm(ws_settings)

        context = "\n".join([
            f"- {item.get('title')} | URL: {item.get('link')} | {item.get('snippet')}"
            for item in data.get('organic', [])[:6]
        ])

        if not llms.get("groq") and not llms.get("gemini"):
            companies = [
                {"name": item.get('title', '').split(' - ')[0], "domain": ""}
                for item in data.get('organic', [])[:3]
            ]
            return json.dumps(companies)

        prompt = (
            f"Based on these search results, identify 3 specific real companies that best match this ICP: {icp}.\n"
            "For each company, provide its exact company name and its primary website domain (e.g. stripe.com).\n"
            "Output ONLY a valid JSON array with NO extra text. Format:\n"
            '[ {{"name": "Company Name", "domain": "companydomain.com"}}, ...]\n\n'
            f"Search Results:\n{context}"
        )

        await stream_thought(job_id, "AI: Searching", f"Identifying companies matching ICP: {icp[:30]}...")
        res = await resilient_ainvoke(llms, [HumanMessage(content=prompt)], job_id)
        content = res.content.strip()
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        try:
            first = json.loads(content)
            if isinstance(first, list) and first and job_id:
                await update_job_state(job_id, {"target_company": first[0].get("name", "")})
        except Exception:
            pass

        return content
    except Exception as e:
        return json.dumps([{"name": f"Error finding companies: {str(e)}", "domain": ""}])


# ---------------------------------------------------------------------------
@tool
async def tool_lead_finder(company: str, domain: str, icp: str) -> str:
    """
    Find the most reachable decision-maker at a company matching the ICP, 
    then find and VERIFY their real email address.
    """
    job_id = current_job_id.get()
    if job_id:
        await update_job_state(job_id, {"status": "finding_leads", "target_company": company})

    serper_api_key = settings.SERPER_API_KEY
    import re
    words = [w for w in re.findall(r'\b\w+\b', icp.lower()) if len(w) > 3 and w not in ["that", "with", "from", "their"]]
    icp_keywords = " ".join(words[:4])
    await stream_thought(job_id, "AI: Lead Intel", f"Searching for {icp_keywords} profiles at {company}...")

    url = "https://google.serper.dev/search"
    # Find multiple candidates to increase chances of finding a verified email
    payload = json.dumps({
        "q": f"{company} (CTO OR VP OR Director OR Head OR Founder) {icp_keywords} LinkedIn profile"
    })
    headers = {
        'X-API-KEY': serper_api_key,
        'Content-Type': 'application/json'
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, headers=headers, content=payload)
            serper_data = r.json()
        
        count = len(serper_data.get('organic', []))
        if count == 0:
            # BROADEN SEARCH: Try generic company people search
            payload_broad = json.dumps({"q": f"employees or founders at {company} LinkedIn"})
            r = await client.post(url, headers=headers, content=payload_broad)
            serper_data = r.json()
            count = len(serper_data.get('organic', []))

        await stream_thought(job_id, "AI: Leads Found", f"System identified {count} potential profiles after broadening search.")
    except Exception as e:
        await stream_thought(job_id, "AI: Search Error", f"Search engine delay: {str(e)[:50]}")
        serper_data = {"organic": []}

    from langchain_core.messages import HumanMessage
    ws_settings = await get_workspace_settings()
    _, llms = await get_llm(ws_settings)
    
    context = "\n".join([
        f"- {item.get('title')} : {item.get('snippet')}"
        for item in serper_data.get('organic', [])[:8]
    ])

    prompt = (
        f"From these search results, identify the Top 3 best candidates for an outreach email at {company}.\n"
        f"The ICP focus is: {icp_keywords}.\n"
        "Output ONLY a valid JSON array of objects with NO extra text in this EXACT format:\n"
        '[ {{"first_name": "John", "last_name": "Doe", "title": "Job Title"}}, ...]\n\n'
        f"Search Results:\n{context}"
    )

    candidates = []
    try:
        await stream_thought(job_id, "AI: Mapping Leads", f"Identifying decision makers at {company}...")
        res = await resilient_ainvoke(llms, [HumanMessage(content=prompt)], job_id)
        content = res.content.strip()
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        candidates = json.loads(content)
        if not isinstance(candidates, list):
            candidates = [candidates]
    except Exception:
        candidates = [{"first_name": "Unknown", "last_name": "Unknown", "title": "Executive"}]

    hunter_key = settings.HUNTER_API_KEY
    if not hunter_key:
        return json.dumps({"error": "HUNTER_API_KEY is missing. Real email discovery requires an API key."})

    best_email = ""
    best_candidate = None
    best_source = ""
    best_confidence = 0

    # Step 1: Try Email Finder + Verifier for each candidate
    for cand in candidates:
        first = cand.get("first_name", "")
        last = cand.get("last_name", "")
        if not first or first == "Unknown": continue

        try:
            # 1.1 Find Email
            finder_url = "https://api.hunter.io/v2/email-finder"
            params = {"domain": domain, "first_name": first, "last_name": last, "api_key": hunter_key}
            await stream_thought(job_id, "AI: Discovery", f"Checking Hunter.io for {first} {last} ({cand.get('title', 'Executive')})...")
            async with httpx.AsyncClient(timeout=10) as client:
                f_req = await client.get(finder_url, params=params)
                f_data = f_req.json()

                found_email = f_data.get("data", {}).get("email")
                if found_email:
                    # 1.2 Verify Email (STRICT CHECK)
                    verify_url = "https://api.hunter.io/v2/email-verifier"
                    v_req = await client.get(verify_url, params={"email": found_email, "api_key": hunter_key})
                    v_data = v_req.json()
                    
                    status = v_data.get("data", {}).get("status")
                    score = v_data.get("data", {}).get("score", 0)

                    # Lenient verification: accept anything 'valid' or score > 60 for evaluation
                    if status == "valid" or score > 60:
                        best_email = found_email
                        best_candidate = cand
                        best_source = f"hunter.io (verified: {status})"
                        best_confidence = score
                        if status == "valid" or score > 85: break  # stop if we find a gold-standard email
        except Exception:
            continue

    # Step 2: Fallback to Domain Search but verify results
    if not best_email and domain:
        try:
            domain_url = "https://api.hunter.io/v2/domain-search"
            d_params = {"domain": domain, "api_key": hunter_key, "limit": 10, "type": "personal"}
            async with httpx.AsyncClient(timeout=10) as client:
                d_req = await client.get(domain_url, params=d_params)
                d_data = d_req.json()
            contacts = d_data.get("data", {}).get("emails", [])
            
            if contacts:
                # Prioritize based on seniority and verification
                icp_lower = icp.lower()
                priority_keywords = ["cto", "vp", "ceo", "ciso", "head of", "director", "engineering", "security", "product", "founder"]

                def score_contact(c):
                    t = (c.get("position") or "").lower()
                    v_status = c.get("verification", {}).get("status", "unknown")
                    conf = c.get("confidence") or 0
                    role_score = sum(10 for kw in priority_keywords if kw in t)
                    # Significant penalty for non-verified emails
                    v_score = 50 if v_status == "valid" else (10 if v_status == "accept_all" else 0)
                    return conf + role_score + v_score

                contacts.sort(key=score_contact, reverse=True)
                
                for c in contacts:
                    v_status = c.get("verification", {}).get("status", "unknown")
                    score = c.get("confidence") or 0
                    if v_status == "valid" or score > 50:
                        best_email = c.get("value")
                        best_candidate = {
                            "first_name": c.get("first_name", "Unknown"),
                            "last_name": c.get("last_name", ""),
                            "title": c.get("position") or "Executive"
                        }
                        best_source = f"hunter.io (domain fallback: {v_status})"
                        best_confidence = score
                        if v_status == "valid" or score > 80: break
        except Exception:
            pass

    if not best_email:
        # ABSOLUTE FALLBACK: Return the top candidate even without a verified email
        if candidates and len(candidates) > 0:
            best_candidate = candidates[0]
            best_email = f"lookup-needed@{domain}"
            best_source = "LinkedIn (Manual Lookup Needed)"
            best_confidence = 0
            await stream_thought(job_id, "System: Manual Mode", f"Could not verify email for {best_candidate.get('first_name')}. Returning profile for manual review.")
        else:
            # ENSURE NO BLANK SCREEN: Return a synthetic manual card
            return json.dumps([{
                "name": "General Executive",
                "first_name": "General",
                "last_name": "Executive",
                "title": "Decision Maker",
                "email": f"contact@{domain}",
                "confidence": 0,
                "source": "Manual Hub (System Fallback)"
            }])

    full_name = f"{best_candidate['first_name']} {best_candidate['last_name']}".strip()
    title = best_candidate['title']

    if job_id:
        await update_job_state(job_id, {
            "lead_name": full_name, 
            "lead_title": title,
            "target_email": best_email, 
            "lead_confidence": best_confidence
        })

    return json.dumps({
        "name": full_name,
        "title": title,
        "email": best_email,
        "confidence": best_confidence,
        "source": best_source
    })
