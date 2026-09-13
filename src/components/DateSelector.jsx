import React from 'react';
import { format, isToday, isTomorrow, addDays } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';

export default function DateSelector() {
  const { selectedDate, setSelectedDate } = useTasks();

  const handleDateChange = (e) => {
    if (e.target.value) {
      // Create date from string keeping local timezone
      const [year, month, day] = e.target.value.split('-');
      setSelectedDate(new Date(year, month - 1, day));
    }
  };

  const handleQuickSelect = (daysToAdd) => {
    const d = new Date();
    d.setHours(0,0,0,0);
    setSelectedDate(addDays(d, daysToAdd));
  };

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => handleQuickSelect(0)}
          className={`flex-1 py-2 px-3 rounded-xl font-medium transition-colors border ${
            isToday(selectedDate) 
              ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => handleQuickSelect(1)}
          className={`flex-1 py-2 px-3 rounded-xl font-medium transition-colors border ${
            isTomorrow(selectedDate) 
              ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-200' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tomorrow
        </button>
        <div className="relative flex-1 flex items-center justify-center">
          <div className={`w-full py-2 px-3 rounded-xl font-medium transition-colors border flex items-center justify-center gap-2 ${
            (!isToday(selectedDate) && !isTomorrow(selectedDate))
              ? 'bg-brand-50 text-brand-600 border-brand-200 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}>
            <CalendarIcon size={16} />
            <span className="truncate">
              {isToday(selectedDate) || isTomorrow(selectedDate) 
                ? format(selectedDate, 'MMM d')
                : format(selectedDate, 'MMM d, yyyy')}
            </span>
          </div>
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={handleDateChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Pick a date"
          />
        </div>
      </div>
    </div>
  );
}
