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
      </div>

      <div className="relative">
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-brand-50 p-2 rounded-lg text-brand-600">
              <CalendarIcon size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Selected Date</p>
              <p className="font-bold text-slate-800">{format(selectedDate, 'EEEE, MMM d, yyyy')}</p>
            </div>
          </div>
          
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={handleDateChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
