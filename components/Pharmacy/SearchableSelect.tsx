import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    disabled?: boolean;
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
    options,
    value,
    onChange,
    placeholder = "Sélectionner...",
    className = "",
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Filter options based on search term
    const filteredOptions = useMemo(() => {
        return options.filter(option =>
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    // Find currently selected option
    const selectedOption = options.find(o => o.value === value);

    const handleSelect = (option: Option) => {
        if (option.disabled) return;
        onChange(option.value);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <div
                className={`
          flex items-center justify-between w-full px-3 py-2 bg-white border border-slate-300 rounded-lg 
          cursor-pointer hover:border-blue-400 transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
          ${isOpen ? 'ring-2 ring-blue-100 border-blue-400' : ''}
        `}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-900'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100">
                    {/* Search Input */}
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white rounded-t-lg">
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Rechercher..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-auto py-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-slate-400 text-center italic">
                                Aucun résultat
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => handleSelect(option)}
                                    className={`
                    w-full px-3 py-2 text-sm flex items-center justify-between
                    ${option.disabled
                                            ? 'bg-slate-50 text-slate-400 cursor-not-allowed italic'
                                            : 'cursor-pointer hover:bg-blue-50 text-slate-700 hover:text-blue-700'}
                    ${option.value === value ? 'bg-blue-50 text-blue-700 font-medium' : ''}
                  `}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {option.value === value && <Check size={14} className="text-blue-600 flex-shrink-0 ml-2" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
