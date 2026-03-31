import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface Option {
    value: string;
    label: string | React.ReactNode;
    searchValue?: string; // used for filtering if label is complex
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options, value, onChange, placeholder = "Sélectionner...", className = "", disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = useMemo(() => options.find(o => o.value === value), [options, value]);

    const filteredOptions = useMemo(() => {
        if (!query) return options;
        const q = query.toLowerCase();
        return options.filter(o => 
            (o.searchValue || (typeof o.label === 'string' ? o.label : '')).toLowerCase().includes(q)
        );
    }, [query, options]);

    return (
        <div ref={wrapperRef} className={`relative w-full ${className} ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
            {/* Trigger Button */}
            <div 
                className="flex items-center justify-between w-full border border-slate-300 rounded bg-white py-1.5 px-3 text-sm cursor-pointer shadow-sm hover:border-blue-400 transition-colors h-[34px]"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="truncate text-slate-700">
                    {selectedOption ? selectedOption.label : <span className="text-slate-400">{placeholder}</span>}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-72">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0 relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            autoFocus
                            placeholder="Rechercher..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-slate-500">
                                Aucun résultat
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = opt.value === value;
                                return (
                                    <div
                                        key={opt.value}
                                        onClick={() => {
                                            onChange(opt.value);
                                            setIsOpen(false);
                                            setQuery('');
                                        }}
                                        className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer rounded-md ${
                                            isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        <div className="truncate pr-4">{opt.label}</div>
                                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
