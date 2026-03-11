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
  AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {

  const [formData, setFormData] = useState({
    icp: "Cybersecurity training for Series B startups",
    company: "Stripe",
    email: "candidate-email@example.com"
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState("");

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setResults(null);

    setStage("Collecting company signals...");

    setTimeout(() => setStage("Researching company profile..."), 2000);
    setTimeout(() => setStage("Generating outreach email..."), 4500);

    try {

      const data = await runAgent(
        formData.company,
        formData.icp,
        formData.email
      );

      setResults(data);

    } catch (err) {

      setError("Agent execution failed");

    }

    setLoading(false);
  };

  return (

    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}

      <header className="bg-white border-b shadow-sm">

        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">

          <div className="flex items-center gap-3">

            <div className="bg-gradient-to-r from-orange-500 to-indigo-600 p-2 rounded-lg text-white">
              <Zap size={20}/>
            </div>

            <div>
              <h1 className="font-bold text-lg text-gray-900">
                FireReach
              </h1>

              <p className="text-xs text-gray-500">
                Autonomous Outreach Engine
              </p>
            </div>

          </div>

          <div className="text-sm text-green-600 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            System Online
          </div>

        </div>

      </header>



      <div className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-12 gap-8">

        {/* LEFT PANEL */}

        <div className="lg:col-span-4">

          <div className="bg-white rounded-xl shadow p-6">

            <h2 className="font-semibold mb-6 flex items-center gap-2 text-gray-800">
              <Target size={18}/>
              Configure Outreach
            </h2>


            <form onSubmit={handleSubmit} className="space-y-5">


              <div>

                <label className="text-sm text-gray-600 flex gap-2 items-center">
                  <BookOpen size={16}/>
                  Ideal Customer Profile
                </label>

                <textarea
                  name="icp"
                  rows="3"
                  value={formData.icp}
                  onChange={handleChange}
                  className="w-full mt-2 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />

              </div>


              <div>

                <label className="text-sm text-gray-600 flex gap-2 items-center">
                  <Building2 size={16}/>
                  Company
                </label>

                <input
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full mt-2 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />

              </div>


              <div>

                <label className="text-sm text-gray-600 flex gap-2 items-center">
                  <Mail size={16}/>
                  Target Email
                </label>

                <input
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full mt-2 border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />

              </div>


              <button
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-indigo-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 font-medium"
              >

                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18}/>
                    {stage}
                  </>
                ) : (
                  <>
                    <Sparkles size={18}/>
                    Run FireReach Agent
                  </>
                )}

              </button>


              {error && (
                <div className="text-red-600 text-sm flex gap-2 items-center">
                  <AlertCircle size={16}/>
                  {error}
                </div>
              )}

            </form>

          </div>

        </div>


        {/* RIGHT PANEL */}

        <div className="lg:col-span-8 space-y-6">

          {!results && !loading && (

            <div className="bg-white rounded-xl shadow p-12 text-center text-gray-500">

              <Zap size={28} className="mx-auto mb-3"/>

              <p>
                Run the FireReach agent to generate outreach insights
              </p>

            </div>

          )}



          {loading && (

            <div className="bg-white rounded-xl shadow p-12 text-center">

              <Loader2 size={26} className="animate-spin mx-auto mb-3"/>

              <p className="text-gray-600">{stage}</p>

            </div>

          )}



          {results && (

            <motion.div
              initial={{opacity:0,y:20}}
              animate={{opacity:1,y:0}}
              className="space-y-6"
            >

              <div className="bg-white rounded-xl shadow p-6">

                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity size={18}/>
                  Captured Signals
                </h3>

                <ul className="text-sm text-gray-600 space-y-2">

                  {results.signals?.map((s,i)=>(
                    <li key={i}>• {s}</li>
                  ))}

                </ul>

              </div>



              <div className="bg-white rounded-xl shadow p-6">

                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <BookOpen size={18}/>
                  Research Brief
                </h3>

                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {results.research}
                </p>

              </div>



              <div className="bg-white rounded-xl shadow p-6">

                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Send size={18}/>
                  Generated Email
                </h3>

                <pre className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap">
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