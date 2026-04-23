import { useState, useEffect } from "react";
import { Zap, Target, Loader2, Play, Users, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { listCampaigns, createCampaign } from "../api";

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [formData, setFormData] = useState({ name: "", icp: "", count: 3 });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadCampaigns = async () => {
    try {
      const data = await listCampaigns();
      setCampaigns(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCampaigns();
    const interval = setInterval(loadCampaigns, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      await createCampaign(formData.name, formData.icp, formData.count);
      setFormData({ name: "", icp: "", count: 3 });
      setSuccess(true);
      await loadCampaigns();
      setTimeout(() => setSuccess(false), 5000);
    } catch (e) {
      alert("Failed to start campaign: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="text-orange-500" />
            Active Campaigns
          </h2>
          <p className="text-gray-500 text-sm mt-1">Manage and track your multi-lead automation batches</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* CREATE CAMPAIGN FORM */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 self-start">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target size={18} className="text-indigo-500" />
            New Campaign
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Campaign Name</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Q3 SaaS Outreach"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Ideal Profile (ICP)</label>
              <textarea
                required
                rows="3"
                value={formData.icp}
                onChange={e => setFormData({ ...formData, icp: e.target.value })}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
                placeholder="Target demographic..."
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Lead Count</label>
              <input
                required
                type="number"
                min="1"
                max="20"
                value={formData.count}
                onChange={e => setFormData({ ...formData, count: e.target.value })}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            
            <AnimatePresence>
              {success && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: "auto" }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-green-50 text-green-700 text-xs p-3 rounded-lg flex items-center gap-2 font-medium"
                >
                  <CheckCircle2 size={14} /> Campaign launched successfully!
                </motion.div>
              )}
            </AnimatePresence>

            <button
              disabled={loading}
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-indigo-600 transition shadow-md disabled:opacity-60 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} className="fill-current" />}
              Launch Sequence
            </button>
          </form>
        </div>

        {/* CAMPAIGN LIST */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Campaign History</h3>
          {campaigns.length === 0 ? (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400 flex flex-col items-center">
               <Users size={48} className="mb-4 opacity-20" />
               <p>No active campaigns found.</p>
               <p className="text-sm mt-1">Start a new sequence to discover leads!</p>
             </div>
          ) : (
            campaigns.map((camp) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={camp.id} 
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex justify-between items-center hover:shadow-md transition-shadow group"
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{camp.name}</h4>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${camp.status === 'running' ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 bg-gray-100'}`}>
                      {camp.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-1 max-w-md">{camp.icp}</p>
                  <p className="text-[10px] text-gray-400 mt-2">Started: {new Date(camp.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-gray-800">{camp.target_count}</div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Leads</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
