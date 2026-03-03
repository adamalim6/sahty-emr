import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Sélectionner...',
    disabled = false,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            setSearch(''); // Reset search when closed
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(search.toLowerCase()) || 
        opt.value.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Control */}
            <div 
                className={`flex items-center justify-between w-full border rounded-lg p-2.5 bg-white cursor-pointer transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:border-blue-400'} ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-300'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="flex-1 truncate text-slate-700">
                    {selectedOption ? selectedOption.label : <span className="text-slate-400">{placeholder}</span>}
                </div>
                <div className="flex items-center space-x-1 ml-2 text-slate-400">
                    {selectedOption && !disabled && (
                        <button 
                            type="button" 
                            className="hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                        >
                            <X size={14} />
                        </button>
                    )}
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Search Bar */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                autoFocus
                                type="text"
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                                placeholder={"Rechercher..."}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto overscroll-contain">
                        {filteredOptions.length === 0 ? (
                            <div className="p-3 text-sm text-center text-slate-400 italic">
                                Aucun résultat trouvé
                            </div>
                        ) : (
                            <ul className="py-1">
                                {filteredOptions.map((option) => (
                                    <li
                                        key={option.value}
                                        className={`px-3 py-2 text-sm cursor-pointer transition-colors ${option.value === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                    >
                                        {option.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
