# FireReach Architecture & Agent Logic

## Overview
FireReach utilizes a **LangChain tool-calling agent architecture** (specifically leveraging the `create_tool_calling_agent` pattern) designed for autonomous, multi-step decision making. Instead of single-prompt generation, the LLM is given access to specific functions (tools) and decides dynamically when and how to invoke them to complete the user's overarching objective.

## Agent Workflow
The core workflow enforces a deterministic, 4-step execution path:
1. **Understand Input**: The agent evaluates the target Company, ICP, and Email Address.
2. **Tool 1: `tool_signal_harvester`**: 
   - Uses the Serper API to perform a live Google Search on the target company.
   - Extracts real-time business signals such as funding, product launches, or hiring.
   - Ensures no hallucination by grounding future steps in these actual search results.
3. **Tool 2: `tool_research_analyst`**:
   - Takes the real signals from Tool 1 and cross-references them with the User's ICP.
   - Triggers an internal LLM call strictly configured for analytical extraction to generate a 2-paragraph account brief.
4. **Tool 3: `tool_outreach_automated_sender`**:
   - Consumes the signals, ICP, and company data.
   - Triggers an internal LLM call to draft a hyper-personalized email referencing *only* the real signals.
   - Automatically executes the dispatch via the Resend API.

## Why Tool Calling?
Using a function-calling agent provides several benefits for GTM workflows:
- **Deterministic Bounds**: By segmenting actions into tools, we control *how* the agent gets data (via Serper) and *how* it communicates (via Resend), limiting rogue AI outputs.
- **Traceability**: Each tool execution modifies a shared state/timeline, allowing the dashboard UI to display the agent's exact thought process (Signals -> Research -> Output).
- **Scalability**: New tools (e.g., `tool_linkedin_scraper`, `tool_crm_updater`) can be seamlessly added to the tool array without modifying core LLM prompt logic.

## Application Architecture
- **FastAPI / Python Backend**: Handles the long-running execution of the Agent and securely manages API keys.
- **React / Tailwind Frontend**: A decoupled SaaS UI that polls/awaits the Agent's execution and distinctively maps the results to modern dashboard panels.
