import React, { useState } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { format } from 'date-fns';
import { AlertCircle, Star, Circle, CheckCircle2, Pencil, Trash2, Repeat } from 'lucide-react';
import RecurringActionModal from '../components/RecurringActionModal';

export default function MatrixView({ onOpenNewTask, onEditTask }) {
  const { tasks, activeProfile, selectedDate, updateTask, deleteTask, deleteTaskOccurrence, deleteTaskSeries, getTasksForDate } = useTasks();
  const [deletingTask, setDeletingTask] = useState(null);

  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const activeTasks = getTasksForDate
    ? getTasksForDate(formattedDate, activeProfile)
    : [];

  const q1 = activeTasks.filter(t => t.is_urgent && t.is_important);
  const q2 = activeTasks.filter(t => !t.is_urgent && t.is_important);
  const q3 = activeTasks.filter(t => t.is_urgent && !t.is_important);
  const q4 = activeTasks.filter(t => !t.is_urgent && !t.is_important);

  const handleDeleteClick = (task) => {
    const isRecurring = Boolean(task.is_recurring) && task.is_recurring !== 'false' || (typeof task.id === 'string' && task.id.startsWith('recurring_')) || Boolean(task.series_id);
    if (isRecurring) {
      setDeletingTask(task);
    } else {
      deleteTask(task.id);
    }
  };

  return (
    <div className="px-4 pb-24 space-y-4">
      <div className="grid grid-cols-2 gap-3 h-[calc(100vh-280px)] min-h-[400px]">
        {/* Q1: Do First */}
        <MatrixQuadrant 
          title="Do First" 
          tasks={q1} 
          updateTask={updateTask}
          onEditTask={onEditTask}
          onDeleteTask={handleDeleteClick}
          bg="bg-red-50" 
          header="bg-red-100 text-red-900" 
          icon={<AlertCircle size={14}/>}
        />
        
        {/* Q2: Schedule */}
        <MatrixQuadrant 
          title="Schedule" 
          tasks={q2} 
          updateTask={updateTask}
          onEditTask={onEditTask}
          onDeleteTask={handleDeleteClick}
          bg="bg-amber-50" 
          header="bg-amber-100 text-amber-900" 
          icon={<Star size={14}/>}
        />
        
        {/* Q3: Delegate */}
        <MatrixQuadrant 
          title="Delegate" 
          tasks={q3} 
          updateTask={updateTask}
          onEditTask={onEditTask}
          onDeleteTask={handleDeleteClick}
          bg="bg-blue-50" 
          header="bg-blue-100 text-blue-900" 
        />
        
        {/* Q4: Don't Do */}
        <MatrixQuadrant 
          title="Don't Do" 
          tasks={q4} 
          updateTask={updateTask}
          onEditTask={onEditTask}
          onDeleteTask={handleDeleteClick}
          bg="bg-slate-50" 
          header="bg-slate-200 text-slate-800" 
        />
      </div>

      <RecurringActionModal
        isOpen={Boolean(deletingTask)}
        onClose={() => setDeletingTask(null)}
        task={deletingTask}
        selectedDate={selectedDate}
        onConfirmThis={() => deletingTask && deleteTaskOccurrence(deletingTask, formattedDate)}
        onConfirmAll={() => deletingTask && deleteTaskSeries(deletingTask)}
      />
    </div>
  );
}

function MatrixQuadrant({ title, tasks, updateTask, onEditTask, onDeleteTask, bg, header, icon }) {
  return (
    <div className={`rounded-xl border border-black/5 overflow-hidden flex flex-col ${bg}`}>
      <div className={`text-xs font-bold uppercase tracking-wider p-2 flex items-center justify-center gap-1.5 ${header}`}>
        {icon} {title}
      </div>
      <div className="p-2 flex-1 overflow-y-auto space-y-1.5">
        {tasks.map(task => (
          <div 
            key={task.id} 
            className={`text-xs p-2 rounded-lg bg-white shadow-sm border border-black/5 flex gap-2 group items-center ${task.is_completed ? 'opacity-50' : 'text-slate-800 font-medium'}`}
          >
            <div 
              className="mt-0.5 flex-shrink-0 cursor-pointer"
              onClick={() => updateTask(task.id, { is_completed: !task.is_completed })}
            >
              {task.is_completed ? <CheckCircle2 size={12} className="text-brand-500"/> : <Circle size={12} className="text-slate-300"/>}
            </div>
            <span className={`line-clamp-2 flex-1 cursor-pointer ${task.is_completed ? 'line-through' : ''}`} onClick={() => updateTask(task.id, { is_completed: !task.is_completed })}>
              {task.profile && (
                <span className={`inline-block mr-1 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  task.profile === 'Pattu' ? 'bg-blue-100/70 text-blue-700' : task.profile === 'Thangam' ? 'bg-pink-100/70 text-pink-700' : 'bg-indigo-100/70 text-indigo-700'
                }`}>
                  {task.profile === 'PattuThangam' ? 'Shared' : task.profile}
                </span>
              )}
              {task.title}
              {Boolean(task.is_recurring) && task.is_recurring !== 'false' && task.recurrence_pattern && (
                <span className="inline-block ml-1 text-purple-600 align-middle" title={`Repeats: ${task.recurrence_pattern}`}>
                  <Repeat size={10} className="inline" />
                </span>
              )}
            </span>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
              <button 
                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                className="p-1 text-slate-400 hover:text-brand-500 hover:bg-slate-50 rounded"
              >
                <Pencil size={12} />
              </button>
              {onDeleteTask && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteTask(task); }}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
