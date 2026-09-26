import React from 'react';
import { Settings, Users, User } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';

export default function Header({ onOpenSettings }) {
  const { identity, activeProfile, setActiveProfile, viewProfiles } = useTasks();

  const profilesList = viewProfiles || [
    { id: 'all', label: 'All Tasks', icon: '🌟' },
    { id: 'Pattu', label: "Pattu's Tasks", icon: '👤' },
    { id: 'Thangam', label: "Thangam's Tasks", icon: '👤' },
    { id: 'PattuThangam', label: 'Shared Tasks', icon: '👥' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-brand-50 p-1.5 rounded-full border border-brand-100 flex items-center justify-center overflow-hidden w-10 h-10">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span class="text-brand-500 font-bold">PT</span>'; }} />
        </div>
        <h1 className="font-bold text-xl text-slate-800 tracking-tight">PT planner</h1>
      </div>

      <div className="flex items-center gap-3">
        <select 
          className="bg-slate-100 border border-slate-200/80 text-sm font-semibold rounded-xl px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none text-slate-700 cursor-pointer hover:bg-slate-200/60 transition-colors shadow-sm"
          value={activeProfile}
          onChange={(e) => setActiveProfile(e.target.value)}
        >
          {profilesList.map(p => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.label}
            </option>
          ))}
        </select>
        
        <button 
          onClick={onOpenSettings}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <Settings size={22} />
        </button>
      </div>
    </header>
  );
}
