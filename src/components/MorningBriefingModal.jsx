import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useTasks } from '../contexts/TaskContext';

export default function MorningBriefingModal({ isOpen, onClose }) {
  const { getTasksForDate, activeProfile } = useTasks();
  const [quotes] = useState([
    "Good morning! Let's conquer the day with a smile and a lot of coffee! ☕",
    "Rise and shine! The world is waiting for your awesomeness! ✨",
    "Wake up and smell the inspiration! You're going to crush it today! 🚀",
    "It's a beautiful morning to chase some goals! 💪",
    "Time to get out of bed and into the zone! 🎯",
    "A new day, a new chance to be incredibly productive (or pretend to be)! 😉",
    "Ready, set, hustle! Let's make today count! 🔥"
  ]);
  const [todaysTasks, setTodaysTasks] = useState([]);
  const [randomQuote, setRandomQuote] = useState('');

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const pattuThangamTasks = getTasksForDate(today, 'PattuThangam');
      const profileTasks = activeProfile !== 'PattuThangam' ? getTasksForDate(today, activeProfile) : [];
      
      const allTodayTasks = [...profileTasks, ...pattuThangamTasks].filter(t => !t.is_completed);
      setTodaysTasks(allTodayTasks);
      
      // Select a random quote
      setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    }
  }, [isOpen, activeProfile, quotes, getTasksForDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-in">
        <div className="bg-brand-50 p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mb-4 text-3xl shadow-inner">
            🌅
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Morning Briefing</h2>
          <p className="text-brand-600 mt-2 font-medium italic">"{randomQuote}"</p>
        </div>

        <div className="p-6 max-h-[50vh] overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center justify-between">
            Your Tasks for Today
            <span className="text-sm bg-slate-100 text-slate-500 py-1 px-3 rounded-full">
              {todaysTasks.length} {todaysTasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </h3>

          {todaysTasks.length > 0 ? (
            <ul className="space-y-3">
              {todaysTasks.map(task => (
                <li key={task.id} className="flex flex-col p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-brand-500 flex-shrink-0" />
                    <span className="font-medium text-slate-800 break-words flex-1">
                      {task.title}
                    </span>
                  </div>
                  {task.reminder_time && (
                    <div className="mt-2 ml-7 text-xs font-semibold text-brand-600 flex items-center gap-1">
                      <span className="bg-brand-100 px-2 py-0.5 rounded text-brand-700">
                        {task.reminder_time}
                      </span>
                      <span className="text-slate-400 capitalize bg-slate-200 px-2 py-0.5 rounded">
                        {task.time_block}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-slate-500 font-medium">Your day is completely clear!</p>
              <p className="text-sm text-slate-400 mt-1">Take some time to relax, or plan ahead.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Let's Go!
          </button>
        </div>
      </div>
    </div>
  );
}
