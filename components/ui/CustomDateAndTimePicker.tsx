import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export const CustomDateAndTimePicker = ({ value, onChange, maxDate, dropUp = false }: { value: string, onChange: (date: string) => void, maxDate?: string, dropUp?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentDateTime, setCurrentDateTime] = useState(value ? new Date(value) : new Date());
    
    // Time state
    const [hour, setHour] = useState(currentDateTime.getHours().toString().padStart(2, '0'));
    const [minute, setMinute] = useState(currentDateTime.getMinutes().toString().padStart(2, '0'));

    const ref = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);
  
    useEffect(() => {
        if (value) {
            const d = new Date(value);
            setCurrentDateTime(d);
            setHour(d.getHours().toString().padStart(2, '0'));
            setMinute(d.getMinutes().toString().padStart(2, '0'));
        }
    }, [value]);
  
    const daysInMonth = new Date(currentDateTime.getFullYear(), currentDateTime.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDateTime.getFullYear(), currentDateTime.getMonth(), 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; 
  
    const handleYearChange = (e: any) => {
        const newD = new Date(currentDateTime);
        newD.setFullYear(parseInt(e.target.value));
        setCurrentDateTime(newD);
    }
    const handleMonthChange = (e: any) => {
        const newD = new Date(currentDateTime);
        newD.setMonth(parseInt(e.target.value));
        setCurrentDateTime(newD);
    }
  
    const applyDateTime = (newDate: Date, h: string, m: string) => {
        const d = new Date(newDate);
        d.setHours(parseInt(h, 10));
        d.setMinutes(parseInt(m, 10));
        d.setSeconds(0);
        d.setMilliseconds(0);
        
        if (maxDate && d > new Date(maxDate)) {
            // Cannot pick future time
            return;
        }
        onChange(d.toISOString());
    }

    const handleDaySelect = (day: number) => {
        const newD = new Date(currentDateTime);
        newD.setDate(day);
        setCurrentDateTime(newD);
        applyDateTime(newD, hour, minute);
        setIsOpen(false);
    }

    const handleTimeChange = (type: 'h' | 'm', val: string) => {
        if (type === 'h') {
            setHour(val);
            applyDateTime(currentDateTime, val, minute);
        } else {
            setMinute(val);
            applyDateTime(currentDateTime, hour, val);
        }
    }
  
    const years = Array.from({length: 120}, (_, i) => new Date().getFullYear() - i);
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  
    const displayDate = value ? 
        new Date(value).toLocaleDateString('fr-FR') + ' ' + new Date(value).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : 
        'Sélectionner date et heure';
  
    return (
      <div className="relative" ref={ref}>
         <button type="button" onClick={() => setIsOpen(!isOpen)} className={`flex w-full justify-between items-center text-left ${!value ? 'text-gray-400' : 'text-gray-900'} hover:bg-gray-100 rounded px-3 py-2 text-[13px] font-medium transition-colors border border-gray-200 hover:border-gray-300 bg-white shadow-sm`}>
           <span className="flex items-center"><Clock size={14} className={`mr-2 transition-colors ${isOpen ? 'text-blue-500' : 'text-gray-400'}`}/> {displayDate}</span>
         </button>
         {isOpen && (
           <div className={`absolute z-[100] ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 w-[300px]`}>
               <div className="flex gap-2 mb-3">
                   <select value={currentDateTime.getMonth()} onChange={handleMonthChange} className="block w-3/5 rounded-lg border-gray-300 py-1.5 text-sm bg-gray-50 text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                       {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                   </select>
                   <select value={currentDateTime.getFullYear()} onChange={handleYearChange} className="block w-2/5 rounded-lg border-gray-300 py-1.5 text-sm bg-gray-50 text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                       {years.map(y => <option key={y} value={y}>{y}</option>)}
                   </select>
               </div>
               <div className="grid grid-cols-7 gap-1 text-center mb-1">
                   {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="text-[10px] font-bold text-gray-400">{d}</div>)}
               </div>
               <div className="grid grid-cols-7 gap-1 text-center mb-3">
                   {Array.from({length: startOffset}).map((_, i) => <div key={`empty-${i}`}/>)}
                   {Array.from({length: daysInMonth}).map((_, i) => {
                       const day = i + 1;
                       const d = new Date(currentDateTime.getFullYear(), currentDateTime.getMonth(), day, parseInt(hour), parseInt(minute));
                       const isFuture = maxDate ? d > new Date(maxDate) : false;
                       // Compare by date only for highlights
                       const isSelected = value && new Date(value).toDateString() === new Date(currentDateTime.getFullYear(), currentDateTime.getMonth(), day).toDateString();
                       return (
                           <button 
                               key={day} 
                               type="button"
                               disabled={isFuture}
                               onClick={() => handleDaySelect(day)}
                               className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : isFuture ? 'text-gray-300 cursor-not-allowed opacity-50' : 'text-gray-700 hover:bg-blue-50'}`}
                           >
                               {day}
                           </button>
                       );
                   })}
               </div>
               {/* Time Picker addition */}
               <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-100">
                   <Clock size={14} className="text-gray-400"/>
                   <select value={hour} onChange={(e) => handleTimeChange('h', e.target.value)} className="rounded-lg border-gray-300 py-1.5 px-2 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500">
                       {Array.from({length: 24}).map((_,i) => {
                           const v = i.toString().padStart(2, '0');
                           return <option key={`h-${v}`} value={v}>{v}h</option>
                       })}
                   </select>
                   <span className="text-gray-400 font-bold">:</span>
                   <select value={minute} onChange={(e) => handleTimeChange('m', e.target.value)} className="rounded-lg border-gray-300 py-1.5 px-2 text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500">
                       {Array.from({length: 60}).map((_,i) => {
                           const v = i.toString().padStart(2, '0');
                           return <option key={`m-${v}`} value={v}>{v}</option>
                       })}
                   </select>
               </div>
           </div>
         )}
      </div>
    );
};
