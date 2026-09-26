import React, { useRef } from 'react';
import { format, isToday, isTomorrow, addDays, subDays } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTasks } from '../contexts/TaskContext';

export default function DateSelector() {
  const { selectedDate, setSelectedDate } = useTasks();
  const dateInputRef = useRef(null);

  const handleDateChange = (e) => {
    if (e.target.value) {
      const parts = e.target.value.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const [year, month, day] = parts;
        setSelectedDate(new Date(year, month - 1, day));
      }
    }
  };

  const handleQuickSelect = (daysToAdd) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setSelectedDate(addDays(d, daysToAdd));
  };

  const handlePrevDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const openCalendar = () => {
    if (dateInputRef.current) {
      try {
        if (typeof dateInputRef.current.showPicker === 'function') {
          dateInputRef.current.showPicker();
        } else {
          dateInputRef.current.focus();
        }
      } catch {
        dateInputRef.current.focus();
      }
    }
  };

  const formattedValue = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedToday = isToday(selectedDate);
  const isSelectedTomorrow = isTomorrow(selectedDate);

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* Previous Day */}
        <button
          type="button"
          onClick={handlePrevDay}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
          title="Previous day"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Quick Today */}
        <button
          type="button"
          onClick={() => handleQuickSelect(0)}
          className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all border ${
            isSelectedToday 
              ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-300' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Today
        </button>

        {/* Quick Tomorrow */}
        <button
          type="button"
          onClick={() => handleQuickSelect(1)}
          className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all border ${
            isSelectedTomorrow 
              ? 'bg-slate-800 text-white border-slate-800 shadow-md shadow-slate-300' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tomorrow
        </button>

        {/* Calendar Picker Trigger */}
        <div className="relative flex-1">
          <button
            type="button"
            onClick={openCalendar}
            className={`w-full py-2 px-3 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center gap-1.5 shadow-sm ${
              (!isSelectedToday && !isSelectedTomorrow)
                ? 'bg-brand-500 text-white border-brand-500 shadow-brand-500/20'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CalendarIcon size={15} />
            <span className="truncate">
              {isSelectedToday
                ? `Today (${format(selectedDate, 'MMM d')})`
                : isSelectedTomorrow
                ? `Tomorrow (${format(selectedDate, 'MMM d')})`
                : format(selectedDate, 'EEE, MMM d')}
            </span>
          </button>
          
          <input
            ref={dateInputRef}
            type="date"
            value={formattedValue}
            onChange={handleDateChange}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        {/* Next Day */}
        <button
          type="button"
          onClick={handleNextDay}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
          title="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
