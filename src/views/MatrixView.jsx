import React from 'react';
import { useTasks } from '../contexts/TaskContext';
import { format } from 'date-fns';
import { AlertCircle, Star, Circle, CheckCircle2, Pencil } from 'lucide-react';

export default function MatrixView({ onOpenNewTask, onEditTask }) {
  const { tasks, activeProfile, selectedDate, updateTask } = useTasks();

  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const activeTasks = tasks.filter(t => t.task_date === formattedDate && t.profile === activeProfile);

  const q1 = activeTasks.filter(t => t.is_urgent && t.is_important);
  const q2 = activeTasks.filter(t => !t.is_urgent && t.is_important);
  const q3 = activeTasks.filter(t => t.is_urgent && !t.is_important);
  const q4 = activeTasks.filter(t => !t.is_urgent && !t.is_important);

  return (
    <div className="px-4 pb-24 space-y-4">
      <div className="grid grid-cols-2 gap-3 h-[calc(100vh-280px)] min-h-[400px]">
        {/* Q1: Do First */}
        <MatrixQuadrant 
          title="Do First" 
          tasks={q1} 
          updateTask={updateTask}
          bg="bg-red-50" 
          header="bg-red-100 text-red-900" 
          icon={<AlertCircle size={14}/>}
        />
        
        {/* Q2: Schedule */}
        <MatrixQuadrant 
          title="Schedule" 
          tasks={q2} 
          updateTask={updateTask}
          bg="bg-amber-50" 
          header="bg-amber-100 text-amber-900" 
          icon={<Star size={14}/>}
        />
        
        {/* Q3: Delegate */}
        <MatrixQuadrant 
          title="Delegate" 
          tasks={q3} 
          updateTask={updateTask}
          bg="bg-blue-50" 
          header="bg-blue-100 text-blue-900" 
        />
        
        {/* Q4: Don't Do */}
        <MatrixQuadrant 
          title="Don't Do" 
          tasks={q4} 
          updateTask={updateTask}
          onEditTask={onEditTask}
          bg="bg-slate-50" 
          header="bg-slate-200 text-slate-800" 
        />
      </div>
    </div>
  );
}

function MatrixQuadrant({ title, tasks, updateTask, onEditTask, bg, header, icon }) {
  return (
    <div className={`rounded-xl border border-black/5 overflow-hidden flex flex-col ${bg}`}>
      <div className={`text-xs font-bold uppercase tracking-wider p-2 flex items-center justify-center gap-1.5 ${header}`}>
        {icon} {title}
      </div>
      <div className="p-2 flex-1 overflow-y-auto space-y-1.5">
        {tasks.map(task => (
          <div 
            key={task.id} 
            className={`text-xs p-2 rounded-lg bg-white shadow-sm border border-black/5 flex gap-2 group ${task.is_completed ? 'opacity-50' : 'text-slate-800 font-medium'}`}
          >
            <div 
              className="mt-0.5 flex-shrink-0 cursor-pointer"
              onClick={() => updateTask(task.id, { is_completed: !task.is_completed })}
            >
              {task.is_completed ? <CheckCircle2 size={12} className="text-brand-500"/> : <Circle size={12} className="text-slate-300"/>}
            </div>
            <span className={`line-clamp-2 flex-1 cursor-pointer ${task.is_completed ? 'line-through' : ''}`} onClick={() => updateTask(task.id, { is_completed: !task.is_completed })}>
              {task.title}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-500 hover:bg-slate-50 rounded transition-all"
            >
              <Pencil size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
