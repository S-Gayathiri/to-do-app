import React from 'react';
import { Settings, Users, User } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';

export default function Header({ onOpenSettings }) {
  const { identity, activeProfile, setActiveProfile, allowedProfiles } = useTasks();

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
          className="bg-slate-100 border-none text-sm font-medium rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none text-slate-700"
          value={activeProfile}
          onChange={(e) => setActiveProfile(e.target.value)}
        >
          {allowedProfiles.map(p => (
            <option key={p} value={p}>
              {p === 'PattuThangam' ? 'Shared Tasks' : `${p}'s Tasks`}
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
