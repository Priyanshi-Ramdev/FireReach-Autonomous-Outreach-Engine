import { useState, useEffect } from "react";
import { discoverCompanies, discoverLeads, discoverAutopilot, runDirectAgent, approveJob, getStats, getAnalyticsTrends, getTemplates, createTemplate } from "../api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Target, Building2, Mail, Zap, Activity, BookOpen, Send, Sparkles, Loader2, AlertCircle, User, Users, BadgeCheck, ShieldAlert, Shield, ArrowRight, UserCheck, Briefcase, Terminal, ChevronRight, Save, Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function ConfidenceBadge({ score }) {
  if (score === null || score === undefined) return null;
  const high = score >= 70;
  const mid = score >= 40;
  const Icon = high ? BadgeCheck : mid ? Shield : ShieldAlert;
  const color = high
    ? "text-green-700 bg-green-50 border-green-200"
    : mid
    ? "text-yellow-700 bg-yellow-50 border-yellow-200"
    : "text-red-700 bg-red-50 border-red-200";
  const label = high ? "High confidence" : mid ? "Medium confidence" : "Low confidence";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      <Icon size={12} />
      {score}% — {label}
    </span>
  );
}

export default function Dashboard() {
  const [icp, setIcp] = useState("Series B SaaS startups hiring backend engineers");
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState(null);
  
  // Wizard State: 'icp_input' | 'companies' | 'leads' | 'generating' | 'results'
  const [stage, setStage] = useState("icp_input"); 
  
  const [companies, setCompanies] = useState([]);
  const [leads, setLeads] = useState([]);
  
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  
  const [results, setResults] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [stats, setStats] = useState({ total_leads: 0, emails_sent: 0, pending_approval: 0, active_campaigns: 0 });
  const [chartData, setChartData] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  
  const [autopilot, setAutopilot] = useState(false);
  const [agentLogs, setAgentLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [sData, tData, tmpData] = await Promise.all([getStats(), getAnalyticsTrends(), getTemplates()]);
        setStats(sData);
        setChartData(tData);
        setTemplates(tmpData);
      } catch (err) {
        console.error("Dashboard mount fetch failed", err);
      }
    };
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveTemplate = async () => {
    if (!newTemplateName || !draftText) return;
    try {
      await createTemplate(newTemplateName, draftText);
      const updated = await getTemplates();
      setTemplates(updated);
      setShowTemplateModal(false);
      setNewTemplateName("");
    } catch (err) {
      alert("Failed to save template");
    }
  };

  const handleLoadTemplate = (content) => {
    setDraftText(content);
  };

  // 1. Discover Companies
  const handleDiscoverCompanies = async (e) => {
    e.preventDefault();
    if (!icp) return;
    setLoadingText(autopilot ? "Autopilot: Rapid extraction engaged..." : "Finding relevant companies...");
    setError(null);
    try {
      if (autopilot) {
        const data = await discoverAutopilot(icp);
        setLeads(data);
        setStage("leads");
      } else {
        const data = await discoverCompanies(icp);
        setCompanies(data);
        setStage("companies");
      }
    } catch (err) {
      setError(err.message);
    }
    setLoadingText("");
  };

  // 2. Discover Leads for a Company
  const handleSelectCompany = async (comp) => {
    setSelectedCompany(comp);
    setLoadingText(`Finding executives at ${comp.name}...`);
    setError(null);
    try {
      const data = await discoverLeads(icp, comp.name, comp.domain);
      setLeads(data);
      setStage("leads");
    } catch (err) {
      setError(err.message);
    }
    setLoadingText("");
  };

  // 3. Draft Outreach for Lead
  const handleSelectLead = async (lead) => {
    if (!lead.email || lead.email.includes("unknown")) {
      // The user edge-case: proceed anyway without verified email if they wish
      if (!window.confirm("No verified email found. Proceed anyway to generate a LinkedIn draft?")) {
        return;
      }
    }
    
    setSelectedLead(lead);
    setStage("generating");
    setLoadingText("Dispatching Agent (Research & Copywriting)...");
    setError(null);
    setResults(null);
    setSent(false);
    setAgentLogs(["Agent initialized. Establishing research perimeter..."]);
    setShowConsole(true);

    try {
      const startData = await runDirectAgent(icp, selectedCompany.name, lead.email || "none@none.com", lead.first_name + " " + lead.last_name, lead.title);
      // Backend returns { status: "dispatched", job_id: "..." }
      const jobId = startData.job_id || startData.id;

      if (!jobId) {
        throw new Error("No job ID returned from server.");
      }

      setAgentLogs(prev => [...prev, `Job dispatched: ${jobId.substring(0, 8)}...`]);

      // Connect WebSocket for live updates
      const ws = new WebSocket(`ws://127.0.0.1:8000/ws/jobs/${jobId}`);
      
      // Safety timeout: if no terminal status in 120s, poll once and show result
      const fallbackTimer = setTimeout(async () => {
        ws.close();
        try {
          const token = localStorage.getItem("firereach_token");
          const r = await fetch(`http://127.0.0.1:8000/api/jobs/${jobId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          const data = await r.json();
          if (data.email_draft) {
            setResults(data);
            setDraftText(data.email_draft || "");
            setStage("results");
            setLoadingText("");
          } else {
            setError("Agent timed out — no draft generated. Please try again.");
            setStage("leads");
            setLoadingText("");
          }
        } catch {
          setError("Agent timed out. Please try again.");
          setStage("leads");
          setLoadingText("");
        }
      }, 120000);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.event === "job_update") {
           const updates = msg.updates;
           
           if (updates.thought) {
              setAgentLogs(prev => [...prev, updates.thought]);
           }

           if (updates.status) {
              setLoadingText(`Agent: ${updates.status.replace(/_/g, ' ')}...`);
           }
           
           if (updates.status === "pending_approval" || updates.status === "sent" || updates.status === "failed") {
              clearTimeout(fallbackTimer);
              ws.close();
              const token = localStorage.getItem("firereach_token");
              fetch(`http://127.0.0.1:8000/api/jobs/${jobId}`, {
                headers: { "Authorization": `Bearer ${token}` }
              })
                .then(r => r.json())
                .then(data => {
                   setResults(data);
                   setDraftText(data.email_draft || "");
                   setStage("results");
                   setLoadingText("");
                });
           }
        }
      };

      ws.onerror = () => {
        setAgentLogs(prev => [...prev, "WebSocket disconnected. Polling for result..."]);
      };
    } catch (err) {
      setError("Failed to connect to agent: " + err.message);
      setStage("leads"); // go back
      setLoadingText("");
    }
  };

  // 4. Approve Draft
  const handleApprove = async () => {
    if (!results || !results.id) return;
    setSending(true);
    try {
      await approveJob(results.id, draftText);
      setSent(true);
    } catch (err) {
      alert("Failed to send email: " + err.message);
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-transparent pb-10">
      
      {/* STATS & TRENDS SECTION */}
      <div className="max-w-7xl mx-auto px-6 pt-10">
        <div className="grid lg:grid-cols-4 gap-6 mb-8">
           
           {/* Analytic Chart Card */}
           <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Activity size={16} className="text-indigo-500" />
                    Targeting Performance (Last 7 Days)
                  </h3>
                  <p className="text-xs text-gray-400">Total high-verified leads discovered daily</p>
                </div>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#94a3b8'}}
                      dy={10}
                    />
                    <YAxis hide hideDomain={true} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}}
                      cursor={{stroke: '#4f46e5', strokeWidth: 1}}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="leads" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorLeads)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Stats Stack */}
           <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600"><Users size={20} /></div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Database</p>
                  <p className="text-xl font-black text-gray-900">{stats.total_leads}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 text-emerald-600">
                <div className="bg-emerald-50 p-3 rounded-xl"><Send size={20} /></div>
                <div>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Sent</p>
                  <p className="text-xl font-black text-gray-900">{stats.emails_sent}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 text-orange-500">
                <div className="bg-orange-50 p-3 rounded-xl"><Zap size={20} /></div>
                <div>
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">Active</p>
                  <p className="text-xl font-black text-gray-900">{stats.active_campaigns}</p>
                </div>
              </div>
           </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-10 grid lg:grid-cols-12 gap-8">

        {/* LEFT PANEL: The Wizard Input */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow p-6 border-t-4 border-indigo-500">

            <div className="flex justify-between items-center mb-6">
              <h2 className="font-semibold flex items-center gap-2 text-gray-800">
                <Target size={18} className="text-indigo-600"/>
                Workflow Engine
              </h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-mono font-medium">
                {stage.toUpperCase()}
              </span>
            </div>

            <form onSubmit={handleDiscoverCompanies} className="space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-700 flex gap-2 items-center mb-2">
                  <BookOpen size={16} className="text-gray-400" />
                  Ideal Customer Profile
                </label>
                <textarea
                  name="icp"
                  rows="4"
                  value={icp}
                  onChange={(e) => setIcp(e.target.value)}
                  disabled={stage !== "icp_input" && stage !== "companies"}
                  className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              {stage === "icp_input" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                       <Cpu size={16} className={autopilot ? "text-indigo-600" : "text-gray-400"} />
                       <div>
                         <p className="text-xs font-bold text-gray-700">Autopilot Mode</p>
                         <p className="text-[10px] text-gray-400">Scan companies & leads instantly</p>
                       </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setAutopilot(!autopilot)}
                      className={`w-10 h-5 rounded-full relative transition-colors ${autopilot ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${autopilot ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  <button
                    disabled={!!loadingText}
                    className="w-full bg-gradient-to-r from-orange-500 to-indigo-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:opacity-90 transition disabled:opacity-60"
                  >
                    {loadingText ? <Loader2 className="animate-spin" size={18} /> : <Building2 size={18} />}
                    {autopilot ? "Launch Autopilot Discovery" : "Find Companies"}
                  </button>
                </div>
              )}

              {stage !== "icp_input" && (
                <button
                  type="button"
                  onClick={() => { setStage("icp_input"); setCompanies([]); setLeads([]); setResults(null); }}
                  className="w-full bg-gray-100 text-gray-600 py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-gray-200 transition"
                >
                  Reset Workflow
                </button>
              )}

              {error && (
                <div className="text-red-600 text-sm flex gap-2 items-start bg-red-50 p-3 rounded-lg">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </form>

            {/* SELECTION SUMMARY */}
            {(selectedCompany || selectedLead) && stage !== "icp_input" && (
              <div className="mt-8 space-y-4 pt-6 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Locked Targets</h3>
                
                {selectedCompany && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-3 items-center">
                    <div className="bg-indigo-100 p-2 rounded-md"><Building2 size={16} className="text-indigo-600" /></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{selectedCompany.name}</p>
                      <p className="text-xs text-gray-500">{selectedCompany.domain || "Unknown Domain"}</p>
                    </div>
                  </div>
                )}

                {selectedLead && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-3 items-center">
                     <div className="bg-emerald-100 p-2 rounded-md"><UserCheck size={16} className="text-emerald-600" /></div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-gray-900 truncate">{selectedLead.first_name} {selectedLead.last_name}</p>
                      <p className="text-xs text-gray-500 truncate">{selectedLead.title}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Interactive Grid */}
        <div className="lg:col-span-8 flex flex-col">

          {/* EMPTY STATE */}
          {stage === "icp_input" && !loadingText && (
            <div className="flex-1 bg-white rounded-xl shadow border border-gray-100 flex items-center justify-center p-12 text-center text-gray-400">
              <div>
                <Zap size={40} className="mx-auto mb-4 opacity-20 text-indigo-500" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Ready for Discovery</h3>
                <p className="text-sm max-w-md mx-auto">Define an ICP on the left to securely scan for target companies and verify decision makers.</p>
              </div>
            </div>
          )}

          {/* LOADING STATE - Covers companies, leads, and generating */}
          {loadingText && (
            <div className="flex-1 bg-white rounded-xl shadow flex flex-col items-center justify-center p-12 text-center border-2 border-indigo-50 border-dashed">
              <Loader2 size={32} className="animate-spin mx-auto mb-4 text-indigo-500" />
              <p className="text-gray-700 font-medium">{loadingText}</p>
              
              {stage === "generating" && (
                <div className="mt-6 flex justify-center gap-2 text-xs text-indigo-500 font-medium">
                  <span className="px-3 py-1.5 bg-indigo-50 rounded-full animate-pulse">Researching</span>
                  <span className="px-3 py-1.5 bg-indigo-50 rounded-full animate-pulse" style={{ animationDelay: "200ms" }}>Strategic Mapping</span>
                  <span className="px-3 py-1.5 bg-indigo-50 rounded-full animate-pulse" style={{ animationDelay: "400ms" }}>Copywriting</span>
                </div>
              )}
            </div>
          )}

          {/* STAGE 2: COMPANIES LIST */}
          {stage === "companies" && !loadingText && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-2">
                <Briefcase size={20} className="text-indigo-500" />
                Target Companies Discovered
                <span className="ml-auto text-xs font-normal text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">{companies.length} Matches</span>
              </h2>
              
              <div className="grid gap-3">
                {companies.map((comp, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all flex justify-between items-center group">
                    <div className="pr-6">
                      <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                        {comp.name}
                      </h3>
                      <p className="text-sm text-indigo-600 font-medium mb-2">{comp.domain}</p>
                      <p className="text-sm text-gray-600 leading-relaxed">{comp.description}</p>
                    </div>
                    <button 
                      onClick={() => handleSelectCompany(comp)}
                      className="shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 group-hover:bg-indigo-600 group-hover:text-white"
                    >
                      Find Decision Makers <ArrowRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STAGE 3: LEADS LIST */}
          {stage === "leads" && !loadingText && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStage("companies")} className="text-sm text-gray-500 hover:text-indigo-600 font-medium">← Back</button>
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <User size={20} className="text-indigo-500" />
                  Executives at {selectedCompany?.name}
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {leads.map((lead, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-gray-900 text-[17px]">
                          {lead.first_name} {lead.last_name}
                        </h3>
                        <ConfidenceBadge score={lead.confidence} />
                      </div>
                      <p className="text-sm font-medium text-gray-600 bg-gray-50 inline-block px-2 py-1 rounded mb-4">{lead.title}</p>
                      
                      <div className="space-y-1 mb-5">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Email Address</p>
                        <p className={`text-sm font-mono ${lead.confidence > 70 ? 'text-green-600' : 'text-gray-800'}`}>
                          {lead.email || "Not discovered"}
                        </p>
                        <p className="text-[10px] text-gray-400">Source: {lead.source}</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleSelectLead(lead)}
                      className="w-full bg-slate-900 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles size={16} /> Target Executive
                    </button>
                  </div>
                ))}

                {leads.length === 0 && (
                  <div className="col-span-2 bg-red-50 p-6 rounded-xl border border-red-100 text-center text-red-600">
                    No relevant executives found matching the ICP parameters.
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* STAGE 4: RESULTS (Email Draft) */}
          {stage === "results" && results && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
                <h3 className="font-semibold flex items-center gap-2 text-gray-800 border-b border-gray-100 pb-4 mb-4">
                  <Activity size={18} className="text-indigo-500" />
                  Live Verification Complete
                </h3>

                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Company Signals Harvested</h4>
                <ul className="text-sm text-gray-600 space-y-2 mb-6 bg-slate-50 p-4 rounded-lg">
                  {results.signals?.map((s, i) => (
                     <li key={i} className="flex gap-2">
                       <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                       <span>{s}</span>
                     </li>
                  ))}
                </ul>

                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Copywriter Research Brief</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed bg-slate-50 p-4 rounded-lg">{results.research}</p>
              </div>

              <div className="bg-white rounded-xl shadow p-6 border-t-4 border-indigo-500">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold flex items-center gap-2 text-gray-800">
                    <Send size={18} className="text-indigo-600"/>
                    Hyper-Personalized Draft
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative group">
                       <button className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 transition-all">
                         <BookOpen size={14} /> Templates
                       </button>
                       <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-100 shadow-xl rounded-xl p-2 hidden group-hover:block z-50">
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest p-2 border-b border-gray-50 mb-1">Library</p>
                         {templates.length === 0 && <p className="text-xs text-gray-400 p-2">No templates saved yet.</p>}
                         <div className="max-h-48 overflow-y-auto">
                           {templates.map(t => (
                             <button 
                               key={t.id} 
                               onClick={() => handleLoadTemplate(t.content)}
                               className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-xs font-medium text-gray-700 flex justify-between items-center truncate transition-colors"
                             >
                               <span className="truncate mr-2">{t.name}</span>
                               <ArrowRight size={10} className="text-gray-300" />
                             </button>
                           ))}
                         </div>
                       </div>
                    </div>
                    <button 
                      onClick={() => setShowTemplateModal(true)}
                      className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-gray-100 transition-all"
                    >
                      <Save size={14} /> Save
                    </button>
                  </div>
                </div>

                <textarea 
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="w-full min-h-[300px] bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 p-5 rounded-lg text-sm font-mono leading-relaxed outline-none resize-y transition-colors"
                />

                <div className="mt-5 flex justify-end">
                  <button 
                    onClick={handleApprove} 
                    disabled={sending || sent || !draftText}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    {sent ? "Sent Successfully!" : "Approve & Send"}
                  </button>
                </div>
              </div>

              {/* TEMPLATE SAVE MODAL */}
              {showTemplateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Save as Template</h3>
                    <p className="text-sm text-gray-500 mb-6">Create a shared snippet for your team to use across campaigns.</p>
                    <input 
                      type="text" 
                      placeholder="Template Name (e.g. Fintech Closer)" 
                      value={newTemplateName}
                      onChange={e => setNewTemplateName(e.target.value)}
                      className="w-full p-3 border border-gray-100 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 mb-6 font-medium text-sm"
                    />
                    <div className="flex gap-3">
                      <button onClick={() => setShowTemplateModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">Cancel</button>
                      <button onClick={handleSaveTemplate} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm">Save Template</button>
                    </div>
                  </motion.div>
                </div>
              )}


            </motion.div>
          )}

        </div>

      </div>

      {/* AGENT CONSOLE DRAWER */}
      <AnimatePresence>
        {showConsole && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-64 right-0 h-64 bg-slate-900 border-t border-slate-700 shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-1.5 rounded-lg text-indigo-400">
                  <Terminal size={14} />
                </div>
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
                  Agent Executive Console
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </h3>
              </div>
              <button 
                onClick={() => setShowConsole(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <ChevronRight size={20} className="rotate-90" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-2 custom-scrollbar">
               {agentLogs.map((log, i) => (
                 <motion.div 
                   initial={{ opacity: 0, x: -10 }} 
                   animate={{ opacity: 1, x: 0 }} 
                   key={i} 
                   className="flex gap-3 text-emerald-400/80"
                 >
                   <span className="text-slate-600">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                   <span className="text-indigo-400">$</span>
                   <p className="leading-relaxed">{log}</p>
                 </motion.div>
               ))}
               <div className="flex gap-3 text-indigo-400 animate-pulse">
                 <span className="text-slate-600">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                 <span>$</span>
                 <p>awaiting next signal...</p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showConsole && stage === "generating" && (
        <button 
          onClick={() => setShowConsole(true)}
          className="fixed bottom-6 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center gap-3 hover:bg-slate-800 transition-all border border-slate-700 z-50"
        >
          <Terminal size={20} className="text-indigo-400" />
          <span className="text-sm font-bold">Open Agent Console</span>
        </button>
      )}

    </div>
  );
}