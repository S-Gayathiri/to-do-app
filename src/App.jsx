import React, { useState } from 'react';
import { TaskProvider } from './contexts/TaskContext';
import Header from './components/Header';
import SettingsPane from './components/SettingsPane';
import DateSelector from './components/DateSelector';
import TimeBlocksView from './views/TimeBlocksView';
import MatrixView from './views/MatrixView';
import TaskEntryModal from './components/TaskEntryModal';
import { LayoutGrid, ListTodo, Plus } from 'lucide-react';

function AppContent() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState('blocks'); // 'blocks' or 'matrix'
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTaskDefaultBlock, setNewTaskDefaultBlock] = useState('morning');
  const [editingTask, setEditingTask] = useState(null);

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

        {/* View Toggle */}
        <div className="px-4 pb-4">
          <div className="bg-slate-200/60 p-1 rounded-xl flex items-center">
            <button 
              onClick={() => setViewMode('blocks')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${viewMode === 'blocks' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
            >
              <ListTodo size={16} /> Blocks
            </button>
            <button 
              onClick={() => setViewMode('matrix')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${viewMode === 'matrix' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
            >
              <LayoutGrid size={16} /> Matrix
            </button>
          </div>
        </div>

        {viewMode === 'blocks' ? (
          <TimeBlocksView onOpenNewTask={openNewTask} onEditTask={openEditTask} />
        ) : (
          <MatrixView onOpenNewTask={openNewTask} onEditTask={openEditTask} />
        )}
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
