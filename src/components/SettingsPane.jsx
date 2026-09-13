import React from 'react';
import { X, Bell, User, Clock } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { requestNotificationPermission } from '../services/notifications';

export default function SettingsPane({ isOpen, onClose }) {
  const { identity, setIdentity, carryForwardTasks } = useTasks();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(localStorage.getItem('notifications_enabled') === 'true');

  const handleIdentityChange = (id) => {
    setIdentity(id);
  };

  const handleNotificationsToggle = async (e) => {
    const enabled = e.target.checked;
    setNotificationsEnabled(enabled);
    localStorage.setItem('notifications_enabled', enabled);
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setNotificationsEnabled(false);
        localStorage.setItem('notifications_enabled', false);
        alert('Notification permission denied. Please enable it in your browser settings.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full max-w-sm h-full shadow-2xl flex flex-col animate-slide-in-right">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-8">
          {/* Identity Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-semibold mb-2">
              <User size={18} className="text-brand-500"/>
              <h3>Who is using this device?</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['Pattu', 'Thangam'].map(person => (
                <button
                  key={person}
                  onClick={() => handleIdentityChange(person)}
                  className={`py-3 px-4 rounded-xl border-2 transition-all font-medium flex items-center justify-center gap-2 ${
                    identity === person 
                    ? 'border-brand-500 bg-brand-50 text-brand-700' 
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${identity === person ? 'bg-brand-500' : 'bg-slate-300'}`} />
                  {person}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-500 mt-2">
              This setting filters your task views so you only see your personal tasks and shared tasks.
            </p>
          </section>

          {/* Notifications Section */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-semibold mb-2">
              <Bell size={18} className="text-brand-500"/>
              <h3>Notifications</h3>
            </div>
            
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
              <label htmlFor="notifications-toggle" className="font-medium text-slate-700">Enable Push Notifications</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  id="notifications-toggle" 
                  className="sr-only peer"
                  checked={notificationsEnabled}
                  onChange={handleNotificationsToggle}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500"></div>
              </label>
            </div>

            <p className="text-sm text-slate-500">
              Receive timely reminders for your scheduled tasks.
            </p>
          </section>


        </div>
      </div>
    </div>
  );
}
