import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

interface CustomDatePickerProps {
   value: string;
   onChange: (date: string) => void;
   min?: string;
   className?: string;
   placeholder?: string;
   hasError?: boolean;
}

type ViewMode = 'day' | 'month' | 'year';

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, min, className = '', placeholder = 'Sélectionner une date', hasError = false }) => {
   const [isOpen, setIsOpen] = useState(false);
   const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
   const [viewMode, setViewMode] = useState<ViewMode>('day');
   const containerRef = useRef<HTMLDivElement>(null);

   // Close on click outside
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
            setIsOpen(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   // Reset view date when opening if value exists
   useEffect(() => {
      if (isOpen && value) {
         setViewDate(new Date(value));
      }
      if (!isOpen) {
         setViewMode('day'); // Reset to day view on close
      }
   }, [isOpen, value]);

   const handlePrevMonth = () => {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
   };

   const handleNextMonth = () => {
       setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
   };

   const handleDateClick = (day: number) => {
      const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      // Adjust for timezone offset to get YYYY-MM-DD
      const year = selected.getFullYear();
      const month = String(selected.getMonth() + 1).padStart(2, '0');
      const d = String(selected.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${d}`;
      
      onChange(dateStr);
      setIsOpen(false);
   };

   const handleYearClick = (year: number) => {
      setViewDate(new Date(year, viewDate.getMonth(), 1));
      setViewMode('day');
   };

   const handleMonthClick = (monthIndex: number) => {
      setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
      setViewMode('day');
   };

   const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
   const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
   const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

   const daysArray = Array.from({ length: 42 }, (_, i) => {
      const dayNum = i - startOffset + 1;
      return (dayNum > 0 && dayNum <= daysInMonth) ? dayNum : null;
   });

   const isDateDisabled = (day: number) => {
      if (!min) return false;
      const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      const minDate = new Date(min);
      current.setHours(0,0,0,0);
      minDate.setHours(0,0,0,0);
      return current < minDate;
   };

   const isDateSelected = (day: number) => {
      if (!value) return false;
      const selected = new Date(value);
      return selected.getDate() === day && 
             selected.getMonth() === viewDate.getMonth() && 
             selected.getFullYear() === viewDate.getFullYear();
   };

   const renderHeader = () => (
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
         {viewMode === 'day' && (
            <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
               <ChevronLeft size={16} />
            </button>
         )}
         
         <div className="flex items-center space-x-1 mx-auto">
             <button 
               onClick={() => setViewMode('month')}
               className="flex items-center space-x-1 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
               <span className="capitalize">{viewDate.toLocaleDateString('fr-FR', { month: 'long' })}</span>
               <ChevronDown size={12} className="text-slate-400" />
            </button>
            <button 
               onClick={() => setViewMode('year')}
               className="flex items-center space-x-1 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
               <span>{viewDate.getFullYear()}</span>
               <ChevronDown size={12} className="text-slate-400" />
            </button>
         </div>

         {viewMode === 'day' && (
            <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
               <ChevronRight size={16} />
            </button>
         )}
      </div>
   );

   const renderYears = () => {
       const currentYear = new Date().getFullYear();
       // Generate range: 2 years back -> 15 years future
       const years = Array.from({ length: 18 }, (_, i) => currentYear - 2 + i);
       
       return (
           <div className="grid grid-cols-3 gap-2 py-2">
               {years.map(year => (
                   <button
                       key={year}
                       onClick={() => handleYearClick(year)}
                       className={`
                           py-2 px-1 text-sm rounded transition-colors
                           ${year === viewDate.getFullYear() 
                               ? 'bg-blue-600 text-white font-bold' 
                               : 'text-slate-700 hover:bg-slate-100'}
                       `}
                   >
                       {year}
                   </button>
               ))}
           </div>
       );
   };

   const renderMonths = () => {
       const months = Array.from({ length: 12 }, (_, i) => {
           return new Date(2000, i, 1).toLocaleDateString('fr-FR', { month: 'short' });
       });

       return (
           <div className="grid grid-cols-3 gap-2 py-2">
               {months.map((month, idx) => (
                   <button
                       key={idx}
                       onClick={() => handleMonthClick(idx)}
                       className={`
                           py-2 px-1 text-sm rounded capitalize transition-colors
                           ${idx === viewDate.getMonth() 
                               ? 'bg-blue-600 text-white font-bold' 
                               : 'text-slate-700 hover:bg-slate-100'}
                       `}
                   >
                       {month}
                   </button>
               ))}
           </div>
       );
   };

   return (
      <div className={`relative ${className}`} ref={containerRef}>
         <div 
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center justify-between w-full px-3 py-1.5 border rounded cursor-pointer transition-colors bg-white ${
               value ? 'text-slate-900' : 'text-slate-400'
            } ${
               hasError 
                  ? 'border-red-500 text-red-600 bg-red-50 ring-1 ring-red-200' 
                  : isOpen 
                     ? 'border-blue-500 ring-1 ring-blue-500' 
                     : 'border-slate-200 hover:border-slate-300'
            }`}
         >
            <span className="text-xs truncate">
                {value ? new Date(value).toLocaleDateString() : placeholder}
            </span>
            <CalendarIcon size={14} className={`${hasError ? 'text-red-400' : 'text-slate-400'} ml-2 flex-shrink-0`} />
         </div>

         {isOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-3 animate-in fade-in zoom-in-95 duration-100">
               {renderHeader()}

               {viewMode === 'day' && (
                  <>
                     <div className="grid grid-cols-7 gap-1 mb-1">
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                           <div key={d} className="text-center text-[10px] font-medium text-slate-400">
                              {d}
                           </div>
                        ))}
                     </div>

                     <div className="grid grid-cols-7 gap-1">
                        {daysArray.map((day, idx) => {
                           if (!day) return <div key={idx} />;
                           
                           const disabled = isDateDisabled(day);
                           const selected = isDateSelected(day);

                           return (
                              <button
                                 key={idx}
                                 disabled={disabled}
                                 onClick={() => !disabled && handleDateClick(day)}
                                 className={`
                                    h-7 w-7 rounded-full text-xs flex items-center justify-center transition-colors
                                    ${selected 
                                       ? 'bg-blue-600 text-white font-bold shadow-sm' 
                                       : disabled 
                                          ? 'text-slate-300 cursor-not-allowed' 
                                          : 'text-slate-700 hover:bg-slate-100 font-medium'
                                    }
                                 `}
                              >
                                 {day}
                              </button>
                           );
                        })}
                     </div>
                  </>
               )}

               {viewMode === 'year' && renderYears()}
               {viewMode === 'month' && renderMonths()}
            </div>
         )}
      </div>
   );
};
