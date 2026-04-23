import { useState, useEffect } from "react";
import { Users, Mail, BadgeCheck, ShieldAlert, Shield, Search, Download, Trash2, CheckSquare, Square, CheckCircle2, RotateCw } from "lucide-react";
import { deleteLead, bulkApproveLeads } from "../api";
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

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      <Icon size={12} />
      {score}%
    </span>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchLeads = async () => {
    try {
      const token = localStorage.getItem("firereach_token");
      const res = await fetch("http://127.0.0.1:8000/api/leads", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      console.error("Failed to load leads", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const filteredLeads = leads.filter(lead => {
    const query = searchTerm.toLowerCase();
    return (
      (lead.lead_name || "").toLowerCase().includes(query) ||
      (lead.target_company || "").toLowerCase().includes(query) ||
      (lead.target_email || "").toLowerCase().includes(query) ||
      (lead.lead_title || "").toLowerCase().includes(query)
    );
  });

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredLeads.length) setSelectedIds([]);
    else setSelectedIds(filteredLeads.map(l => l.id));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this lead permanently?")) return;
    try {
      await deleteLead(id);
      setLeads(prev => prev.filter(l => l.id !== id));
      setSelectedIds(prev => prev.filter(x => x !== id));
    } catch (err) {
      alert("Failed to delete lead");
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} leads?`)) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await deleteLead(id);
      }
      setLeads(prev => prev.filter(l => !selectedIds.includes(l.id)));
      setSelectedIds([]);
    } catch (err) {
      alert("Some deletions failed");
    }
    setIsProcessing(false);
  };

  const handleBulkApprove = async () => {
    if (!window.confirm(`Approve and send emails to ${selectedIds.length} lead(s)?`)) return;
    setIsProcessing(true);
    try {
      await bulkApproveLeads(selectedIds);
      setSelectedIds([]);
      setTimeout(fetchLeads, 1000); // refresh to see 'sent' status
    } catch (err) {
      alert("Bulk approval failed");
    }
    setIsProcessing(false);
  };

  const handleExportCSV = () => {
    if (!filteredLeads.length) return;
    const headers = ["Name", "Title", "Email", "Company", "Confidence", "Status"];
    const rows = filteredLeads.map(l => [
      `"${(l.lead_name || "").replace(/"/g, '""')}"`,
      `"${(l.lead_title || "").replace(/"/g, '""')}"`,
      `"${(l.target_email || "").replace(/"/g, '""')}"`,
      `"${(l.target_company || "").replace(/"/g, '""')}"`,
      l.lead_confidence || 0,
      `"${(l.status || "").replace(/_/g, ' ')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `firereach_leads.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-indigo-500" />
            Lead CRM Database
          </h2>
          <p className="text-gray-500 text-sm mt-1">Database of all successfully discovered executives and verified emails.</p>
        </div>
        <div className="flex gap-3">
           <button onClick={fetchLeads} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"><RotateCw size={20} /></button>
           <button 
             onClick={handleExportCSV}
             disabled={filteredLeads.length === 0}
             className="bg-white border border-gray-200 hover:border-indigo-400 text-gray-700 hover:text-indigo-600 font-medium py-2 px-4 rounded-xl shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
           >
             <Download size={18} />
             Export CSV
           </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        
        {/* TOOLBAR */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
           <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search leads..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <AnimatePresence>
                {selectedIds.length > 0 && (
                   <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex items-center gap-2 border-l pl-4 border-gray-200">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{selectedIds.length} Selected</span>
                      <button 
                        onClick={handleBulkApprove}
                        className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 size={14} /> Bulk Approve
                      </button>
                      <button 
                        onClick={handleBulkDelete}
                        className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                   </motion.div>
                )}
              </AnimatePresence>
           </div>
           <span className="text-sm font-semibold text-gray-500">{filteredLeads.length} Targets Found</span>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center">
             <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
             <p>Syncing CRM data...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
             <Users size={48} className="mx-auto mb-4 opacity-10" />
             No leads found. {searchTerm ? "Try a different search query." : "Run a campaign first!"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b text-xs uppercase tracking-wider text-gray-400">
                  <th className="p-4 font-bold w-12">
                     <button onClick={toggleSelectAll} className="text-gray-300 hover:text-indigo-500">
                        {selectedIds.length === filteredLeads.length ? <CheckSquare size={18} className="text-indigo-500" /> : <Square size={18} />}
                     </button>
                  </th>
                  <th className="p-4 font-bold">Contact Name</th>
                  <th className="p-4 font-bold">Company</th>
                  <th className="p-4 font-bold">Verified Email</th>
                  <th className="p-4 font-bold text-center">Confidence</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.includes(lead.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="p-4">
                       <button onClick={() => toggleSelect(lead.id)} className="text-gray-300 hover:text-indigo-500">
                          {selectedIds.includes(lead.id) ? <CheckSquare size={18} className="text-indigo-500" /> : <Square size={18} />}
                       </button>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-gray-900">{lead.lead_name || "Unknown Executive"}</p>
                      <p className="text-xs text-gray-500">{lead.lead_title || "Executive"}</p>
                    </td>
                    <td className="p-4 text-sm font-semibold text-indigo-700">
                      {lead.target_company}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded w-max">
                        <Mail size={14} className="text-gray-400" />
                        {lead.target_email}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <ConfidenceBadge score={lead.lead_confidence} />
                    </td>
                    <td className="p-4">
                       <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${lead.status === 'sent' ? 'bg-green-100 text-green-700' : lead.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                         {(lead.status || "").replace('_', ' ')}
                       </span>
                    </td>
                    <td className="p-4 text-right">
                       <button 
                        onClick={() => handleDelete(lead.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                       >
                         <Trash2 size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
