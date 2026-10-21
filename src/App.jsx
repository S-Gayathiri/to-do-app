import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { TaskProvider } from './contexts/TaskContext';
import Header from './components/Header';
import SettingsPane from './components/SettingsPane';
import DateSelector from './components/DateSelector';
import TimeBlocksView from './views/TimeBlocksView';
import TaskEntryModal from './components/TaskEntryModal';
import EveningReviewModal from './components/EveningReviewModal';
import MorningBriefingModal from './components/MorningBriefingModal';
import { LayoutGrid, ListTodo, Plus } from 'lucide-react';

function AppContent() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTaskDefaultBlock, setNewTaskDefaultBlock] = useState('morning');
  const [editingTask, setEditingTask] = useState(null);
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

  const openNewTask = (block = 'morning') => {
    setEditingTask(null);
    setNewTaskDefaultBlock(block);
    setIsNewTaskOpen(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setIsNewTaskOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      
      <main className="max-w-md mx-auto">
        <DateSelector />

        <TimeBlocksView onOpenNewTask={openNewTask} onEditTask={openEditTask} />
      </main>

      {/* FAB */}
      <button 
        onClick={() => openNewTask('morning')}
        className="fixed bottom-6 right-6 z-30 bg-brand-600 text-white p-4 rounded-full shadow-xl shadow-brand-500/30 hover:bg-brand-700 active:scale-95 transition-all"
      >
        <Plus size={28} />
      </button>

      <SettingsPane isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      <TaskEntryModal 
        isOpen={isNewTaskOpen} 
        onClose={() => { setIsNewTaskOpen(false); setEditingTask(null); }} 
        defaultBlock={newTaskDefaultBlock}
        editingTask={editingTask}
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
