import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Campaigns from './components/Campaigns';
import Leads from './components/Leads';
import Login from './components/Login';
import Settings from './components/Settings';
import QuickSend from './components/QuickSend';

function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem("firereach_token"));

  if (!authToken) {
    return <Login setAuthToken={setAuthToken} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar />
        <main className="flex-1 ml-64 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/quick-send" element={<QuickSend />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
