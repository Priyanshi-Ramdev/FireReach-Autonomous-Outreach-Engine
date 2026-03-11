import { useState } from "react";
import { runAgent } from "../api";
import {
  Zap,
  Building2,
  Mail,
  Loader2,
  Sparkles,
  Activity,
  BookOpen,
  Send
} from "lucide-react";

export default function Dashboard() {
  const [formData, setFormData] = useState({
    icp: "Cybersecurity training for Series B startups",
    company: "Stripe",
    email: "candidate-email@example.com"
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResults(null);

    try {
      const data = await runAgent(
        formData.company,
        formData.icp,
        formData.email
      );

      setResults(data);
    } catch (err) {
      alert("Agent failed");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Header */}

      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Zap className="text-orange-500" />
            <h1 className="font-bold text-xl">
              FireReach
            </h1>
          </div>

          <span className="text-sm text-gray-500">
            Autonomous Outreach Engine
          </span>
        </div>
      </header>


      <div className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-8">


        {/* LEFT PANEL */}

        <div className="lg:col-span-4 bg-white rounded-xl shadow p-6">

          <h2 className="font-semibold mb-6 flex items-center gap-2">
            <Sparkles size={18} />
            Configure Outreach
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">


            <div>
              <label className="text-sm text-gray-600 flex gap-2 items-center">
                <BookOpen size={16} />
                Ideal Customer Profile
              </label>

              <textarea
                rows="3"
                name="icp"
                value={formData.icp}
                onChange={handleChange}
                className="w-full mt-1 border rounded-lg p-3 text-sm"
              />
            </div>


            <div>
              <label className="text-sm text-gray-600 flex gap-2 items-center">
                <Building2 size={16} />
                Company
              </label>

              <input
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="w-full mt-1 border rounded-lg p-3 text-sm"
              />
            </div>


            <div>
              <label className="text-sm text-gray-600 flex gap-2 items-center">
                <Mail size={16} />
                Target Email
              </label>

              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full mt-1 border rounded-lg p-3 text-sm"
              />
            </div>


            <button
              disabled={loading}
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Running Agent...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Run FireReach
                </>
              )}
            </button>
          </form>
        </div>



        {/* RIGHT PANEL */}

        <div className="lg:col-span-8 space-y-6">


          {!results && !loading && (
            <div className="bg-white rounded-xl shadow p-10 text-center text-gray-500">
              <Zap className="mx-auto mb-3" size={30} />
              Run the agent to generate outreach insights
            </div>
          )}



          {loading && (
            <div className="bg-white rounded-xl shadow p-10 text-center">
              <Loader2 className="animate-spin mx-auto mb-3" size={28} />
              Agent analyzing company signals...
            </div>
          )}



          {results && (
            <>

              {/* SIGNALS */}

              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Activity size={18} />
                  Signals
                </h3>

                <ul className="space-y-2 text-sm text-gray-600">
                  {results.signals?.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>



              {/* RESEARCH */}

              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BookOpen size={18} />
                  Research
                </h3>

                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {results.research}
                </p>
              </div>



              {/* EMAIL */}

              <div className="bg-white rounded-xl shadow p-6">

                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Send size={18} />
                  Generated Email
                </h3>

                <pre className="bg-gray-100 rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {results.email}
                </pre>

                {results.target_email && (
                  <p className="text-green-600 text-sm mt-4">
                    Email sent to {results.target_email}
                  </p>
                )}

              </div>

            </>
          )}

        </div>
      </div>
    </div>
  );
}