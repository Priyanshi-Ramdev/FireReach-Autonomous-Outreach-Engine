import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Key, Server, Webhook, Zap, ShieldCheck, Save, Loader2, CheckCircle2 } from "lucide-react";
import { getWorkspaceSettings, updateWorkspaceSettings } from "../api";
import { motion, AnimatePresence } from "framer-motion";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("integrations");
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getWorkspaceSettings();
        setSettings(data);
      } catch (err) {
        console.error("Failed to load settings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await updateWorkspaceSettings(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setSettings({ ...settings, [field]: value });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <Loader2 className="animate-spin mx-auto mb-4" size={32} />
        Loading workspace configuration...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen bg-transparent">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon className="text-indigo-500" />
            Workspace Settings
          </h2>
          <p className="text-gray-500 text-sm mt-1">Manage your API integrations, LLM personas, and email delivery rules.</p>
        </div>
        
        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
              className="bg-green-50 text-green-700 text-xs px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-sm border border-green-100 mb-2"
            >
              <CheckCircle2 size={14} /> Settings synced to cloud
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Nav */}
        <div className="w-64 shrink-0 space-y-2">
          <button 
            onClick={() => setActiveTab("integrations")}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex gap-3 items-center ${activeTab === 'integrations' ? 'bg-white shadow-sm text-indigo-600 border border-indigo-100' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Key size={16} /> API Integrations
          </button>
          <button 
            onClick={() => setActiveTab("prompts")}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex gap-3 items-center ${activeTab === 'prompts' ? 'bg-white shadow-sm text-indigo-600 border border-indigo-100' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Zap size={16} /> AI Personas (LLM)
          </button>
          <button 
            onClick={() => setActiveTab("smtp")}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex gap-3 items-center ${activeTab === 'smtp' ? 'bg-white shadow-sm text-indigo-600 border border-indigo-100' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Server size={16} /> SMTP Config
          </button>
        </div>

        {/* Content Area */}
        <form onSubmit={handleSave} className="flex-1 space-y-6">
          
          {activeTab === "integrations" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-gray-800">Language Model (Groq)</h3>
                    <p className="text-xs text-gray-500 mt-1">Handles natural language understanding and copywriting.</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 ${settings.groq_api_key ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <ShieldCheck size={12} /> {settings.groq_api_key ? 'Active' : 'Missing'}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">GROQ_API_KEY (Primary)</label>
                  <input 
                    type="password" 
                    placeholder="gsk_..."
                    value={settings.groq_api_key || ""} 
                    onChange={e => updateField("groq_api_key", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all mb-4" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">GOOGLE_API_KEY (Fallback)</label>
                  <input 
                    type="password" 
                    placeholder="AIza..."
                    value={settings.google_api_key || ""} 
                    onChange={e => updateField("google_api_key", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-gray-800">Deep Web Search (Serper)</h3>
                    <p className="text-xs text-gray-500 mt-1">Executes real-time searches to find target companies.</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 ${settings.serper_api_key ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <ShieldCheck size={12} /> {settings.serper_api_key ? 'Active' : 'Missing'}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">SERPER_API_KEY</label>
                  <input 
                    type="password"
                    placeholder="API Key"
                    value={settings.serper_api_key || ""} 
                    onChange={e => updateField("serper_api_key", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                 <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-gray-800">Email Verification (Hunter.io)</h3>
                    <p className="text-xs text-gray-500 mt-1">Validates email bouncing using server pinging.</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 ${settings.hunter_api_key ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <ShieldCheck size={12} /> {settings.hunter_api_key ? 'Active' : 'Missing'}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">HUNTER_API_KEY</label>
                  <input 
                    type="password" 
                    placeholder="API Key"
                    value={settings.hunter_api_key || ""} 
                    onChange={e => updateField("hunter_api_key", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "prompts" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-2">Outreach Tone & Persona Rules</h3>
              <p className="text-xs text-gray-600 mb-6">These global instructions are appended to the AI during the copywriting phase.</p>
              
              <textarea 
                rows="8"
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 p-4 rounded-xl text-sm leading-relaxed outline-none resize-none transition-all"
                value={settings.persona_prompt}
                onChange={e => updateField("persona_prompt", e.target.value)}
              />
              <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Expert Hint</p>
                <p className="text-xs text-indigo-700">Detailed personas lead to 40% higher email response rates. Include specific constraints like "No buzzwords" or "Friendly tone".</p>
              </div>
            </div>
          )}

          {activeTab === "smtp" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
               <h3 className="font-bold text-gray-800 mb-2">Email Relay Server</h3>
               <p className="text-xs text-gray-600 mb-6">The server used to natively dispatch approved emails.</p>
               <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">SENDER ALIAS</label>
                    <input 
                      type="text" 
                      value={settings.sender_email} 
                      onChange={e => updateField("sender_email", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">SMTP HOST</label>
                    <input 
                      type="text" 
                      value={settings.smtp_host} 
                      onChange={e => updateField("smtp_host", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">PORT</label>
                    <input 
                      type="number" 
                      value={settings.smtp_port} 
                      onChange={e => updateField("smtp_port", parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">USERNAME</label>
                    <input 
                      type="text" 
                      value={settings.smtp_user} 
                      onChange={e => updateField("smtp_user", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">PASSWORD</label>
                    <input 
                      type="password" 
                      value={settings.smtp_password} 
                      onChange={e => updateField("smtp_password", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                    />
                  </div>
               </div>
            </div>
          )}

          <div className="flex justify-end">
            <button 
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Configuration
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
