import { useState } from "react";
import { runAgent } from "../api";
import {
  Target,
  Building2,
  Mail,
  Zap,
  Activity,
  BookOpen,
  Send,
  Sparkles,
  Loader2,
  AlertCircle,
  User,
  BadgeCheck,
  ShieldAlert,
  Shield
} from "lucide-react";
import { motion } from "framer-motion";

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
  const [formData, setFormData] = useState({
    icp: "SaaS startups hiring backend engineers",
    company: "",
    email: ""
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState("");
  const [autonomous, setAutonomous] = useState(true);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    const stages = autonomous
      ? [
          "Identifying target companies matching ICP...",
          "Finding reachable decision-maker via Hunter.io...",
          "Harvesting live buyer signals...",
          "Generating research brief...",
          "Sending personalized outreach..."
        ]
      : [
          "Harvesting company signals...",
          "Analyzing account brief...",
          "Drafting personalized email..."
        ];

    let i = 0;
    setStage(stages[0]);
    const stageInterval = setInterval(() => {
      i = Math.min(i + 1, stages.length - 1);
      setStage(stages[i]);
    }, 8000);

    try {
      const data = await runAgent(
        autonomous ? null : formData.company || null,
        formData.icp,
        autonomous ? null : formData.email || null
      );
      setResults(data);
    } catch (err) {
      setError("Agent execution failed. Check the backend logs.");
    }

    clearInterval(stageInterval);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-orange-500 to-indigo-600 p-2 rounded-lg text-white">
              <Zap size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">FireReach</h1>
              <p className="text-xs text-gray-500">Autonomous Outreach Engine</p>
            </div>
          </div>
          <div className="text-sm text-green-600 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            System Online
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-8">

        {/* LEFT PANEL */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow p-6">

            <div className="flex justify-between items-center mb-6">
              <h2 className="font-semibold flex items-center gap-2 text-gray-800">
                <Target size={18} />
                Configure Outreach
              </h2>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autonomous}
                  onChange={() => setAutonomous(!autonomous)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-700">Auto</span>
              </label>
            </div>

            {autonomous && (
              <div className="mb-4 text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg px-3 py-2 flex gap-2 items-start">
                <Sparkles size={14} className="mt-0.5 shrink-0" />
                <span>Agent will autonomously find a matching company, discover a real verified email via Hunter.io, and send personalized outreach.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ICP */}
              <div>
                <label className="text-sm text-gray-600 flex gap-2 items-center mb-1">
                  <BookOpen size={16} />
                  Ideal Customer Profile
                </label>
                <textarea
                  name="icp"
                  rows="4"
                  value={formData.icp}
                  onChange={handleChange}
                  placeholder="e.g. Series B SaaS startups hiring backend engineers with a focus on security"
                  className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              {/* Company (hidden in auto mode) */}
              {!autonomous && (
                <div>
                  <label className="text-sm text-gray-600 flex gap-2 items-center mb-1">
                    <Building2 size={16} />
                    Company
                  </label>
                  <input
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="e.g. Stripe"
                    className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}

              {/* Email (hidden in auto mode) */}
              {!autonomous && (
                <div>
                  <label className="text-sm text-gray-600 flex gap-2 items-center mb-1">
                    <Mail size={16} />
                    Target Email
                  </label>
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g. john@stripe.com"
                    className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}

              <button
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-indigo-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span className="truncate">{stage}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Run FireReach Agent
                  </>
                )}
              </button>

              {error && (
                <div className="text-red-600 text-sm flex gap-2 items-center">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:col-span-8 space-y-6">

          {!results && !loading && (
            <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
              <Zap size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Enter an ICP and run the agent to discover real leads.</p>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-xl shadow p-12 text-center">
              <Loader2 size={28} className="animate-spin mx-auto mb-4 text-indigo-500" />
              <p className="text-gray-600 text-sm font-medium">{stage}</p>
              <div className="mt-4 flex justify-center gap-2 text-xs text-gray-400">
                {["Companies", "Lead", "Signals", "Research", "Email"].map((s, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}

          {results && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >

              {/* Lead Card */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-800">
                  <Activity size={18} />
                  Outreach Target
                </h3>

                <div className="grid grid-cols-2 gap-4">

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Company</p>
                    <p className="text-sm font-semibold text-indigo-700">{results.target_company || "—"}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Status</p>
                    <p className="text-xs font-medium text-green-600">✓ Workflow Complete</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 col-span-2">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                      <User size={10} /> Lead Discovered
                    </p>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {results.lead_name || "Unknown"}{results.lead_title ? ` — ${results.lead_title}` : ""}
                      </p>
                      <p className="text-xs text-gray-500 font-mono break-all">{results.target_email || "—"}</p>
                      <div className="mt-1">
                        <ConfidenceBadge score={results.lead_confidence} />
                      </div>
                    </div>
                  </div>

                </div>

                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-5 mb-3">Live Signals</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  {results.signals?.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Research Brief */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-800">
                  <BookOpen size={18} />
                  Research Brief
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{results.research}</p>
              </div>

              {/* Generated Email */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-800">
                  <Send size={18} />
                  Generated & Sent Email
                </h3>
                <pre className="bg-gray-50 border border-gray-100 p-4 rounded-lg text-sm whitespace-pre-wrap font-mono leading-relaxed">
                  {results.email}
                </pre>
              </div>

            </motion.div>
          )}

        </div>

      </div>
    </div>
  );
}