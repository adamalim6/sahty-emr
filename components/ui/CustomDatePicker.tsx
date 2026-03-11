import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  error?: boolean;
  disabled?: boolean;
  disableFuture?: boolean;
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, label, error, disabled, disableFuture }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'DAYS' | 'MONTHS' | 'YEARS'>('DAYS');
  
  // Internal date state for navigation
  const [currentDate, setCurrentDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setCurrentDate(new Date(value));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
      const day = new Date(year, month, 1).getDay();
      return day === 0 ? 6 : day - 1; // Adjust for Monday start (0-6)
  };

  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    // Empty slots for prev month
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }
    
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = value === dateStr;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;

        const dateObj = new Date(year, month, d);
        const isFuture = disableFuture && dateObj > new Date();

        days.push(
            <button
                key={d}
                onClick={() => {
                    if (isFuture) return;
                    onChange(dateStr);
                    setIsOpen(false);
                }}
                disabled={isFuture}
                className={`
                    h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${isFuture 
                        ? 'opacity-30 cursor-not-allowed text-slate-400 bg-transparent'
                        : isSelected 
                            ? 'bg-emerald-600 text-white shadow-md' 
                            : isToday 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'hover:bg-slate-100 text-slate-700'
                    }
                `}
            >
                {d}
            </button>
        );
    }
    return days;
  };

  const generateYears = () => {
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let y = currentYear + (disableFuture ? 0 : 5); y >= 1900; y--) {
          const isFutureYear = disableFuture && y > currentYear;
          years.push(
              <button
                  key={y}
                  disabled={isFutureYear}
                  onClick={() => {
                      if (isFutureYear) return;
                      setCurrentDate(new Date(y, currentDate.getMonth(), 1));
                      setView('MONTHS');
                  }}
                  className={`
                      py-2 px-4 rounded-lg text-sm font-bold transition-colors
                      ${isFutureYear ? 'opacity-30 cursor-not-allowed text-slate-400' : 'hover:bg-slate-100'}
                      ${currentDate.getFullYear() === y ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600'}
                  `}
              >
                  {y}
              </button>
          );
      }
      return years;
  };

  return (
    <div className="flex flex-col space-y-1.5 w-full text-left" ref={containerRef}>
      {label && (
        <label className={`text-[10px] font-extrabold uppercase tracking-wider ${error ? 'text-red-500' : 'text-slate-500'}`}>
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={`
                w-full rounded-xl border py-2.5 px-3 text-sm font-medium transition-all outline-none flex items-center justify-between
                ${error ? 'bg-red-50 border-red-300 text-red-900 icon-red-400' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'}
                ${disabled ? 'opacity-60 bg-slate-50 cursor-not-allowed' : ''}
            `}
        >
            <div className="flex items-center gap-2">
                <Calendar size={16} className={error ? 'text-red-400' : 'text-slate-400'} />
                <span>{value ? new Date(value).toLocaleDateString('fr-FR') : 'JJ/MM/AAAA'}</span>
            </div>
        </button>

        {isOpen && (
            <div className="absolute top-full left-0 z-50 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 w-[320px] animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    {view === 'DAYS' && (
                        <>
                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-1 hover:bg-slate-100 rounded-lg">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={() => setView('MONTHS')} className="text-sm font-bold hover:bg-slate-50 px-2 py-1 rounded-lg">
                                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </button>
                            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-1 hover:bg-slate-100 rounded-lg">
                                <ChevronRight size={16} />
                            </button>
                        </>
                    )}
                    {(view === 'MONTHS' || view === 'YEARS') && (
                        <button onClick={() => setView(view === 'MONTHS' ? 'DAYS' : 'MONTHS')} className="text-sm font-bold flex items-center gap-1 hover:bg-slate-50 px-2 py-1 rounded-lg">
                            <ChevronLeft size={14} /> Retour
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="min-h-[240px]">
                    {view === 'DAYS' && (
                        <>
                            <div className="grid grid-cols-7 mb-2 text-center">
                                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                                    <span key={d} className="text-[10px] font-bold text-slate-400">{d}</span>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {generateCalendar()}
                            </div>
                        </>
                    )}

                    {view === 'MONTHS' && (
                        <div className="grid grid-cols-3 gap-2">
                             {MONTHS.map((m, idx) => {
                                 const isFutureMonth = disableFuture && currentDate.getFullYear() === new Date().getFullYear() && idx > new Date().getMonth();
                                 return (
                                     <button
                                        key={m}
                                        disabled={isFutureMonth}
                                        onClick={() => {
                                            if (isFutureMonth) return;
                                            setCurrentDate(new Date(currentDate.getFullYear(), idx, 1));
                                            setView('DAYS');
                                        }}
                                        className={`
                                            p-3 rounded-xl text-xs font-bold transition-all
                                            ${isFutureMonth ? 'opacity-30 cursor-not-allowed text-slate-400' : 'hover:bg-slate-50 text-slate-700'}
                                            ${currentDate.getMonth() === idx ? 'bg-emerald-50 text-emerald-600' : ''}
                                        `}
                                     >
                                         {m}
                                     </button>
                                 );
                             })}
                             <button onClick={() => setView('YEARS')} className="col-span-3 mt-2 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl">
                                 Changer l'année ({currentDate.getFullYear()})
                             </button>
                        </div>
                    )}

                    {view === 'YEARS' && (
                        <div className="h-[240px] overflow-y-auto grid grid-cols-4 gap-2 pr-2 custom-scrollbar">
                            {generateYears()}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
