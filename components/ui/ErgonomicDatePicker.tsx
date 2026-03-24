import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Check } from 'lucide-react';

interface ErgonomicDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  includeTime?: boolean;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}

const MONTHS = ['JAN', 'FEV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOU', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_OF_WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// --- Helper UI Component: The Slot-Machine Scroll Column ---
interface ScrollColumnProps {
  items: { value: number; label: string | number }[];
  value: number;
  onChange: (val: number) => void;
  itemHeight?: number;
  containerHeight?: number;
  className?: string;
  highlightClass?: string;
  gradientFrom?: string;
}

const ScrollColumn: React.FC<ScrollColumnProps> = ({ 
  items, value, onChange, itemHeight = 36, containerHeight = 300, className = "w-16", highlightClass = "bg-indigo-50/50 border-indigo-100/50", gradientFrom = "white"
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const paddingTopBottom = (containerHeight - itemHeight) / 2;
  const isProgrammaticScroll = useRef(false);

  // Sync scroll position when value changes from outside
  useEffect(() => {
    if (containerRef.current) {
      const activeIndex = items.findIndex(i => i.value === value);
      if (activeIndex !== -1) {
        const targetScrollTop = activeIndex * itemHeight;
        if (Math.abs(containerRef.current.scrollTop - targetScrollTop) > 2) {
          isProgrammaticScroll.current = true;
          containerRef.current.scrollTop = targetScrollTop;
          setTimeout(() => { isProgrammaticScroll.current = false; }, 250);
        }
      }
    }
  }, [value, items, itemHeight]);

  // Handle native user scrolling to auto-select
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current) return;
    const target = e.currentTarget;
    if ((target as any).scrollTimeout) clearTimeout((target as any).scrollTimeout);
    
    (target as any).scrollTimeout = setTimeout(() => {
       const scrollTop = target.scrollTop;
       const index = Math.round(scrollTop / itemHeight);
       if (index >= 0 && index < items.length) {
         if (items[index].value !== value) {
            onChange(items[index].value);
         }
       }
    }, 100);
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ height: containerHeight }}>
      {/* Top Gradient */}
      <div className="absolute top-0 inset-x-0 h-1/3 pointer-events-none z-20" style={{ backgroundImage: `linear-gradient(to bottom, ${gradientFrom}, ${gradientFrom}00)` }} />
      {/* Bottom Gradient */}
      <div className="absolute bottom-0 inset-x-0 h-1/3 pointer-events-none z-20" style={{ backgroundImage: `linear-gradient(to top, ${gradientFrom}, ${gradientFrom}00)` }} />
      
      {/* Center Highlight */}
      <div 
        className={`absolute top-1/2 -translate-y-1/2 inset-x-2 rounded-lg pointer-events-none z-0 border ${highlightClass}`} 
        style={{ height: itemHeight }}
      />
      
      {/* Scrollable Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-hide snap-y snap-mandatory relative z-10"
        style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div style={{ height: paddingTopBottom }} className="shrink-0" />
        {items.map(item => (
          <div 
            key={item.value}
            onClick={() => onChange(item.value)}
            className={`flex items-center justify-center cursor-pointer snap-center transition-all duration-200 select-none ${
              item.value === value ? 'active-item text-indigo-700 font-black' : 'text-gray-400 font-medium hover:text-gray-600'
            }`}
            style={{ 
              height: itemHeight, 
              fontSize: item.value === value ? '14px' : '12px',
              transform: item.value === value ? 'scale(1.15)' : 'scale(1)'
            }}
          >
            {item.label}
          </div>
        ))}
        <div style={{ height: paddingTopBottom }} className="shrink-0" />
      </div>
    </div>
  );
};

// --- Main Component ---
export const ErgonomicDatePicker: React.FC<ErgonomicDatePickerProps> = ({ 
  value, 
  onChange, 
  includeTime = false,
  placeholder = "Sélectionner une date...",
  className = "",
  triggerClassName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Height definitions for dynamic modal growth
  const BASE_HEIGHT = 264; // Perfectly sizes to the 6-row calendar grid without extra space
  const TIME_PANE_HEIGHT = 96;
  const mainHeight = includeTime ? BASE_HEIGHT + TIME_PANE_HEIGHT : BASE_HEIGHT;

  // Generate generic items
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: currentYear - 1900 + 11 }, (_, i) => 1900 + i).reverse().map(y => ({ value: y, label: y }));
  const MONTH_ITEMS = MONTHS.map((m, i) => ({ value: i, label: m }));
  const HOUR_ITEMS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${i.toString().padStart(2, '0')}h` }));
  const MINUTE_ITEMS = Array.from({ length: 60 }, (_, i) => ({ value: i, label: `${i.toString().padStart(2, '0')}m` }));

  // Local state
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [day, setDay] = useState<number>(new Date().getDate());
  const [hour, setHour] = useState<number>(new Date().getHours());
  const [minute, setMinute] = useState<number>(new Date().getMinutes());

  const [inputText, setInputText] = useState("");

  const pad = (n: number) => n.toString().padStart(2, '0');

  // Sync external -> internal
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setYear(d.getFullYear());
        setMonth(d.getMonth());
        setDay(d.getDate());
        setHour(d.getHours());
        setMinute(d.getMinutes());
      }
    }
  }, [value, isOpen]);

  // Sync internal -> input text
  useEffect(() => {
    const formatted = `${pad(day)}/${pad(month + 1)}/${year}${includeTime ? ` à ${pad(hour)}:${pad(minute)}` : ''}`;
    setInputText(formatted);
  }, [year, month, day, hour, minute, includeTime]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calendar Engine
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Mon=0
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Auto-cap day out-of-bounds
  useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth);
  }, [year, month, daysInMonth, day]);

  const handleConfirm = () => {
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    const timeStr = `${pad(hour)}:${pad(minute)}`;
    onChange(includeTime ? `${dateStr}T${timeStr}` : dateStr);
    setIsOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    const regex = includeTime 
      ? /^(\d{2})\/(\d{2})\/(\d{4})(?:\s*à\s*(\d{2}):(\d{2}))?$/
      : /^(\d{2})\/(\d{2})\/(\d{4})$/;
      
    const match = val.match(regex);
    if (match) {
      const [, d, m, y, h, min] = match;
      const parsedDay = parseInt(d, 10);
      const parsedMonth = parseInt(m, 10) - 1;
      const parsedYear = parseInt(y, 10);

      if (parsedMonth >= 0 && parsedMonth <= 11 && parsedDay >= 1 && parsedDay <= 31 && parsedYear >= 1900 && parsedYear <= currentYear + 10) {
        setYear(parsedYear);
        setMonth(parsedMonth);
        setDay(parsedDay);
        
        if (includeTime && h && min) {
          const parsedHour = parseInt(h, 10);
          const parsedMinute = parseInt(min, 10);
          if (parsedHour >= 0 && parsedHour <= 23 && parsedMinute >= 0 && parsedMinute <= 59) {
            setHour(parsedHour);
            setMinute(parsedMinute);
          }
        }
      }
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Styled Trigger */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClassName || "bg-white border border-gray-200 shadow-sm rounded-lg px-3 py-2 text-sm text-gray-800 cursor-pointer hover:border-indigo-400 transition-all flex items-center min-w-[220px] max-w-xs"}
      >
        {includeTime ? <Clock size={16} className="mr-2 opacity-70 shrink-0" /> : <Calendar size={16} className="mr-2 opacity-70 shrink-0" />}
        <span className={value ? "font-semibold truncate" : "opacity-50 truncate"}>
          {value 
            ? (includeTime ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : new Date(value).toLocaleDateString('fr-FR')) 
            : placeholder}
        </span>
      </div>

      {/* Modern Popover */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-[100] bg-white shadow-2xl rounded-2xl overflow-hidden border border-gray-100 flex flex-col w-[380px] animate-in fade-in zoom-in-95 duration-150 origin-top-left ring-1 ring-black/5">
          
          <div className="flex" style={{ height: `${mainHeight}px` }}>
            {/* COLUMN 1: YEARS */}
            <ScrollColumn 
              items={YEARS} 
              value={year} 
              onChange={setYear} 
              containerHeight={mainHeight}
              className="w-[72px] bg-[#f8fafc] border-r border-[#e2e8f0]" 
              gradientFrom="#f8fafc"
              highlightClass="bg-white shadow-sm border-[#e2e8f0]"
            />

            {/* COLUMN 2: MONTHS */}
            <ScrollColumn 
              items={MONTH_ITEMS} 
              value={month} 
              onChange={setMonth} 
              containerHeight={mainHeight}
              className="w-[72px] bg-[#f1f5f9] border-r border-[#e2e8f0]" 
              gradientFrom="#f1f5f9"
              highlightClass="bg-white shadow-sm border-[#e2e8f0]"
            />

            {/* COLUMN 3: DAYS (+ TIME BELOW) */}
            <div className="flex-1 flex flex-col bg-white">
              
              {/* DAYS GRID - Now fixed height and non-scrollable */}
              <div className="p-4 overflow-hidden relative" style={{ height: `${BASE_HEIGHT}px` }}>
                <div className="grid grid-cols-7 gap-y-2 gap-x-1 justify-items-center mb-3">
                  {DAYS_OF_WEEK.map((d, i) => (
                    <div key={i} className="text-[10px] font-bold text-gray-400 select-none">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 justify-items-center">
                  {Array.from({ length: startOffset }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-7 h-7"></div>
                  ))}
                  {daysArray.map(d => (
                    <div 
                      key={d}
                      onClick={() => setDay(d)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer select-none transition-all duration-200 font-bold
                        ${day === d 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transform scale-110' 
                          : 'bg-transparent text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      {d}
                    </div>
                  ))}
                </div>
              </div>

              {/* TIME PICKER (Optional) */}
              {includeTime && (
                <div className="flex border-t border-gray-100 bg-[#f8fafc]" style={{ height: `${TIME_PANE_HEIGHT}px` }}>
                  <ScrollColumn 
                    items={HOUR_ITEMS} 
                    value={hour} 
                    onChange={setHour} 
                    containerHeight={TIME_PANE_HEIGHT}
                    itemHeight={32}
                    className="flex-1" 
                    gradientFrom="#f8fafc"
                    highlightClass="bg-white shadow-sm border-[#e2e8f0]"
                  />
                  <div className="flex items-center text-gray-300 font-bold -mt-2">:</div>
                  <ScrollColumn 
                    items={MINUTE_ITEMS} 
                    value={minute} 
                    onChange={setMinute} 
                    containerHeight={TIME_PANE_HEIGHT}
                    itemHeight={32}
                    className="flex-1" 
                    gradientFrom="#f8fafc"
                    highlightClass="bg-white shadow-sm border-[#e2e8f0]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* FOOTER SYNC INPUT */}
          <div className="w-full bg-[#f1f5f9] border-t border-[#e2e8f0] flex items-center h-12 px-3">
            <input 
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              className="flex-1 bg-white border border-[#e2e8f0] text-gray-700 rounded-md px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 placeholder:text-gray-300 transition-shadow"
              placeholder={includeTime ? 'JJ/MM/AAAA à HH:MM' : 'JJ/MM/AAAA'}
            />
            <button 
              onClick={handleConfirm}
              className="ml-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-3 py-1.5 text-xs font-bold transition-colors flex items-center shadow-sm"
            >
              <Check size={14} className="mr-1" />
              Valider
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
