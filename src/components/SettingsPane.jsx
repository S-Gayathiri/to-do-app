import React, { useState } from 'react';
import { X, Bell, User, Clock, RefreshCw } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';
import { requestNotificationPermission, scheduleTaskReminder } from '../services/notifications';

export default function SettingsPane({ isOpen, onClose }) {
  const { identity, setIdentity, carryForwardTasks, tasks } = useTasks();
  const [notificationsEnabled, setNotificationsEnabled] = useState(localStorage.getItem('notifications_enabled') === 'true');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState('');

  const handleTestNotification = async () => {
    setIsTestingPush(true);
    setTestPushStatus('Sending test notification...');
    try {
      const res = await fetch('/api/test-push');
      const data = await res.json();
      if (res.ok && data.success) {
        setTestPushStatus(data.message || '✅ Test push sent! Check your notification bar.');
      } else {
        setTestPushStatus(`❌ ${data.message || 'Failed to send test push.'}`);
      }
    } catch (err) {
      setTestPushStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsTestingPush(false);
    }
  };

  const handleIdentityChange = (id) => {
    setIdentity(id);
  };

  const handleNotificationsToggle = async (e) => {
    const enabled = e.target.checked;
    setNotificationsEnabled(enabled);
    localStorage.setItem('notifications_enabled', enabled);
    if (enabled) {
      const granted = await requestNotificationPermission(identity);
      if (!granted) {
        setNotificationsEnabled(false);
        localStorage.setItem('notifications_enabled', false);
        alert('Notification permission denied. Please enable it in your browser settings.');
      }
    }
  };

  const handleResyncReminders = async () => {
    const recurringTasks = (tasks || []).filter(t => t.is_recurring && t.reminder_time);
    if (recurringTasks.length === 0) {
      setSyncStatus('No recurring tasks with reminders found.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus(`Resyncing ${recurringTasks.length} recurring reminder(s)...`);
    try {
      for (const t of recurringTasks) {
        await scheduleTaskReminder(t);
      }
      setSyncStatus(`Successfully resynced ${recurringTasks.length} reminder(s) to your timezone!`);
    } catch (err) {
      console.error('Failed to resync reminders:', err);
      setSyncStatus('Failed to resync some reminders. Try again.');
    } finally {
      setIsSyncing(false);
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

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={isTestingPush}
                className="w-full py-2.5 px-4 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Bell size={14} className={isTestingPush ? "animate-bounce" : ""} />
                {isTestingPush ? 'Sending Test Push...' : 'Send Test Notification Now'}
              </button>
              {testPushStatus && (
                <p className="text-[11px] font-medium text-center text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {testPushStatus}
                </p>
              )}

              <button
                type="button"
                onClick={handleResyncReminders}
                disabled={isSyncing}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncing ? "animate-spin text-brand-600" : "text-slate-500"} />
                {isSyncing ? 'Resyncing Reminders...' : 'Resync Recurring Reminders'}
              </button>
              {syncStatus && (
                <p className="text-xs text-brand-600 font-medium text-center">
                  {syncStatus}
                </p>
              )}
            </div>
          </section>


        </div>
      </div>
    </div>
  );
}
