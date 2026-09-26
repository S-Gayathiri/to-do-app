import React, { useState } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { format } from 'date-fns';
import { CheckCircle2, Circle, AlertCircle, Star, Trash2, Plus, Pencil, Repeat } from 'lucide-react';

const formatRecurrenceBadge = (pattern) => {
  if (!pattern) return '';
  const p = pattern.toLowerCase();
  if (p === 'daily') return 'Daily';
  if (p === 'weekly') return 'Weekly';
  if (p === 'monthly') return 'Monthly';
  return pattern;
};

const blocks = [
  { id: 'morning', label: 'Morning', icon: '🌅', color: 'bg-amber-50 text-amber-900 border-amber-200' },
  { id: 'afternoon', label: 'Afternoon', icon: '☀️', color: 'bg-blue-50 text-blue-900 border-blue-200' },
  { id: 'evening', label: 'Evening', icon: '🌇', color: 'bg-orange-50 text-orange-900 border-orange-200' },
  { id: 'night', label: 'Night', icon: '🌙', color: 'bg-indigo-50 text-indigo-900 border-indigo-200' }
];

import RecurringActionModal from '../components/RecurringActionModal';

export default function TimeBlocksView({ onOpenNewTask, onEditTask }) {
  const { tasks, activeProfile, selectedDate, updateTask, deleteTask, deleteTaskOccurrence, deleteTaskSeries, getTasksForDate } = useTasks();
  const [deletingTask, setDeletingTask] = useState(null);

  const formattedDate = format(selectedDate, 'yyyy-MM-dd');

  const activeTasks = getTasksForDate 
    ? getTasksForDate(formattedDate, activeProfile)
    : [];

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
      {blocks.map(block => {
        const blockTasks = activeTasks.filter(t => t.time_block === block.id);
        return (
          <div key={block.id} className={`rounded-2xl border ${block.color} overflow-hidden shadow-sm`}>
            <div className="flex items-center justify-between px-4 py-3 bg-white/50 backdrop-blur-sm border-b border-black/5">
              <div className="flex items-center gap-2">
                <span className="text-xl">{block.icon}</span>
                <h3 className="font-bold">{block.label}</h3>
              </div>
              <button 
                onClick={() => onOpenNewTask(block.id)}
                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
            
            <div className="p-2 space-y-2">
              {blockTasks.length === 0 ? (
                <div className="py-4 text-center opacity-60 text-sm font-medium">
                  No tasks scheduled.
                </div>
              ) : (
                blockTasks.map(task => (
                  <TaskCard key={task.id} task={task} onUpdate={updateTask} onDelete={handleDeleteClick} onEdit={onEditTask} />
                ))
              )}
            </div>
          </div>
        );
      })}

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

function TaskCard({ task, onUpdate, onDelete, onEdit }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl bg-white shadow-sm border transition-all ${task.is_completed ? 'opacity-60 border-transparent' : 'border-slate-100'}`}>
      <button 
        onClick={() => onUpdate(task.id, { is_completed: !task.is_completed })}
        className="mt-0.5 flex-shrink-0 text-slate-400 hover:text-brand-500 transition-colors"
      >
        {task.is_completed ? <CheckCircle2 className="text-brand-500" size={22} /> : <Circle size={22} />}
      </button>
      
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-slate-800 ${task.is_completed ? 'line-through' : ''}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {task.profile && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              task.profile === 'Pattu' 
                ? 'bg-blue-50 text-blue-700 border-blue-100' 
                : task.profile === 'Thangam'
                ? 'bg-pink-50 text-pink-700 border-pink-100'
                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
            }`}>
              {task.profile === 'PattuThangam' ? '👥 Shared' : `👤 ${task.profile}`}
            </span>
          )}
          {task.is_urgent && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertCircle size={10} /> Urgent
            </span>
          )}
          {task.is_important && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <Star size={10} /> Important
            </span>
          )}
          {task.reminder_time && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              🔔 {task.reminder_time}
            </span>
          )}
          {Boolean(task.is_recurring) && task.is_recurring !== 'false' && task.recurrence_pattern && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
              <Repeat size={10} /> {formatRecurrenceBadge(task.recurrence_pattern)}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button 
          onClick={() => onEdit(task)}
          className="p-1.5 text-slate-300 hover:text-brand-500 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <Pencil size={16} />
        </button>
        <button 
          onClick={() => onDelete(task)}
          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
