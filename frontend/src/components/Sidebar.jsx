import { NavLink } from "react-router-dom";
import { CopySlash, Users, Settings, BarChart2, Zap, Send } from "lucide-react";

export default function Sidebar() {
  const links = [
    { name: "Overview", icon: BarChart2, path: "/" },
    { name: "Campaigns", icon: Zap, path: "/campaigns" },
    { name: "Quick Send", icon: Send, path: "/quick-send" },
    { name: "Lead CRM", icon: Users, path: "/leads" },
    { name: "Settings", icon: Settings, path: "/settings" },
  ];

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 text-white flex flex-col h-screen fixed top-0 left-0">
      <div className="px-6 py-8 flex items-center gap-3">
        <div className="bg-gradient-to-r from-orange-500 to-indigo-600 p-2 rounded-lg text-white shadow-lg">
          <Zap size={22} className="fill-current" />
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight">FireReach</h1>
          <p className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">Business Edition</p>
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {links.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`
            }
          >
            <item.icon size={18} />
            {item.name}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 text-green-400 text-sm font-semibold mb-1">
             <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
             System Online
          </div>
          <p className="text-xs text-slate-400 mt-2">WebSocket streams active. Ready for batch dispatch.</p>
        </div>
      </div>
    </div>
  );
}
