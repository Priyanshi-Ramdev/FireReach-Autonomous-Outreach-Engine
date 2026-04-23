import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";

export default function Login({ setAuthToken }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");

      localStorage.setItem("firereach_token", data.access_token);
      setAuthToken(data.access_token);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
      <div className="max-w-sm w-full bg-slate-800 rounded-3xl p-10 border border-slate-700 shadow-2xl">
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-orange-500 to-indigo-600 p-3 rounded-2xl shadow-lg">
            <Zap size={32} className="fill-current text-white" />
          </div>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">FireReach CRM</h1>
          <p className="text-slate-400 text-sm mt-2">Enter admin passcode to access your workspace.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <input
              type="password"
              placeholder="Admin Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          
          {error && <p className="text-red-400 text-xs font-semibold text-center">{error}</p>}
          
          <button
            disabled={loading || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Authenticate"}
          </button>
        </form>
      </div>
    </div>
  );
}
