import React, { useState } from 'react';
import { Send, Mail, User, Type, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function QuickSend() {
  const [formData, setFormData] = useState({
    to_email: '',
    subject: '',
    body: ''
  });
  const [status, setStatus] = useState('idle'); // idle, sending, success, error
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setError('');

    const token = localStorage.getItem('firereach_token');
    try {
      // Using a completely unique route to bypass any stale server cache
      const response = await fetch('http://127.0.0.1:8000/api/quick-manual-dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || `Server error: ${response.status}`);
      }

      setStatus('success');
      setFormData({ to_email: '', subject: '', body: '' });
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="flex-1 p-8 bg-slate-950 min-h-screen text-slate-200">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Quick Send
          </h1>
          <p className="text-slate-400 mt-2">Send a manual outreach email to any recipient instantly.</p>
        </header>

        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8 backdrop-blur-sm shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Mail size={14} /> Recipient Email
              </label>
              <input
                required
                type="email"
                placeholder="CEO@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                value={formData.to_email}
                onChange={(e) => setFormData({...formData, to_email: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Type size={14} /> Subject Line
              </label>
              <input
                required
                type="text"
                placeholder="Thinking about your recent growth at [Company]..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Mail size={14} /> Message Body (HTML supported)
              </label>
              <textarea
                required
                rows={10}
                placeholder="Write your personalized message here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
                value={formData.body}
                onChange={(e) => setFormData({...formData, body: e.target.value})}
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            {status === 'success' && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
                <CheckCircle size={18} />
                Email sent successfully!
              </div>
            )}

            <button
              disabled={status === 'sending'}
              type="submit"
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                status === 'sending' 
                ? 'bg-slate-800 text-slate-500' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:scale-[1.01]'
              }`}
            >
              {status === 'sending' ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Send Instant Outreach
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
