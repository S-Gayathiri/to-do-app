import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { TaskProvider } from './contexts/TaskContext';
import Header from './components/Header';
import SettingsPane from './components/SettingsPane';
import DateSelector from './components/DateSelector';
import TimeBlocksView from './views/TimeBlocksView';
import TaskEntryModal from './components/TaskEntryModal';
import RecurringTaskModal from './components/RecurringTaskModal';
import EveningReviewModal from './components/EveningReviewModal';
import MorningBriefingModal from './components/MorningBriefingModal';
import { Plus, Repeat } from 'lucide-react';

function AppContent() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTaskDefaultBlock, setNewTaskDefaultBlock] = useState('morning');
  const [editingTask, setEditingTask] = useState(null);
  
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurringTask, setEditingRecurringTask] = useState(null);

  const [isEveningReviewOpen, setIsEveningReviewOpen] = useState(false);
  const [isMorningBriefingOpen, setIsMorningBriefingOpen] = useState(false);

  useEffect(() => {
    const checkRoutines = () => {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      
      // Evening Review (8 PM or later)
      if (now.getHours() >= 20) {
        const lastReview = localStorage.getItem('last_evening_review');
        if (lastReview !== todayStr) {
          setIsEveningReviewOpen(true);
          localStorage.setItem('last_evening_review', todayStr);
        }
      }
      
      // Morning Briefing (6 AM to 11 AM)
      if (now.getHours() >= 6 && now.getHours() < 12) {
        const lastBriefing = localStorage.getItem('last_morning_briefing');
        if (lastBriefing !== todayStr) {
          setIsMorningBriefingOpen(true);
          localStorage.setItem('last_morning_briefing', todayStr);
        }
      }
    };
    
    checkRoutines();
    const interval = setInterval(checkRoutines, 60000);
    return () => clearInterval(interval);
  }, []);

  const getCurrentTimeBlock = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  };

  const openNewTask = (block = 'morning') => {
    setEditingTask(null);
    setNewTaskDefaultBlock(block);
    setIsNewTaskOpen(true);
  };

  const openEditTask = (task) => {
    if (task.is_recurring) {
      setEditingRecurringTask(task);
      setIsRecurringModalOpen(true);
    } else {
      setEditingTask(task);
      setIsNewTaskOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      
      <main className="max-w-md mx-auto">
        <DateSelector />

        <TimeBlocksView onOpenNewTask={openNewTask} onEditTask={openEditTask} />
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-2.5">
        {/* Recurrence + Button sitting above single + */}
        <button 
          onClick={() => { setEditingRecurringTask(null); setIsRecurringModalOpen(true); }}
          className="w-10 h-10 rounded-full bg-purple-600 text-white shadow-lg shadow-purple-500/25 hover:bg-purple-700 active:scale-95 transition-all flex items-center justify-center relative group"
          title="Add Recurring Task / Habit"
        >
          <Repeat size={16} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-800 text-[9px] font-bold text-white">
            +
          </span>
        </button>

        {/* Single Task + Button */}
        <button 
          onClick={() => openNewTask(getCurrentTimeBlock())}
          className="w-14 h-14 rounded-full bg-brand-600 text-white shadow-xl shadow-brand-500/35 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center"
          title="Quick Add Task"
        >
          <Plus size={28} />
        </button>
      </div>

      <SettingsPane isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Standard Single Task Modal */}
      <TaskEntryModal 
        isOpen={isNewTaskOpen} 
        onClose={() => { setIsNewTaskOpen(false); setEditingTask(null); }} 
        defaultBlock={newTaskDefaultBlock}
        editingTask={editingTask}
      />

      {/* Dedicated Recurring Task Modal */}
      <RecurringTaskModal
        isOpen={isRecurringModalOpen}
        onClose={() => { setIsRecurringModalOpen(false); setEditingRecurringTask(null); }}
        editingTask={editingRecurringTask}
      />

      <EveningReviewModal
        isOpen={isEveningReviewOpen}
        onClose={() => setIsEveningReviewOpen(false)}
      />

      <MorningBriefingModal
        isOpen={isMorningBriefingOpen}
        onClose={() => setIsMorningBriefingOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <TaskProvider>
      <AppContent />
    </TaskProvider>
  );
}
