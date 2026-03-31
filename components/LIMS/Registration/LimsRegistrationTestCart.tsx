import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../services/api';
import { Search, FlaskConical, Trash2, CreditCard, ChevronRight, X, AlertCircle } from 'lucide-react';

export interface CartTestItem {
    id: string; // unique cart id 
    global_act_id: string;
    label: string;
    code?: string;
}

interface LimsRegistrationTestCartProps {
    cart: CartTestItem[];
    onCartChange: (cart: CartTestItem[]) => void;
    disabled?: boolean;
}

export const LimsRegistrationTestCart: React.FC<LimsRegistrationTestCartProps> = ({
    cart,
    onCartChange,
    disabled = false
}) => {
    const [allActs, setAllActs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredActs, setFilteredActs] = useState<any[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Initial load of biology acts
    useEffect(() => {
        api.limsConfig.getBiologyActs().then(data => {
            // Keep only active tests? The API might already filter, or we can assume all are valid.
            setAllActs(data || []);
        }).catch(err => console.error(err));
    }, []);

    // Filter acts
    useEffect(() => {
        if (!searchQuery) {
            setFilteredActs([]);
            setSelectedIndex(0);
            return;
        }
        
        const q = searchQuery.toLowerCase();
        const results = allActs.filter(a => 
            (a.label && a.label.toLowerCase().includes(q)) || 
            (a.code && a.code.toLowerCase().includes(q))
        ).slice(0, 50); // limit to 50
        
        setFilteredActs(results);
        setSelectedIndex(0);
    }, [searchQuery, allActs]);

    const handleAddAct = (act: any) => {
        if (disabled) return;
        
        onCartChange([
            ...cart, 
            {
                id: Math.random().toString(36).substr(2, 9),
                global_act_id: act.id,
                label: act.label,
                code: act.code
            }
        ]);
        setSearchQuery('');
        if (searchInputRef.current) searchInputRef.current.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filteredActs.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredActs.length > 0 && selectedIndex >= 0) {
                handleAddAct(filteredActs[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setSearchQuery('');
        }
    };

    const handleRemove = (cartId: string) => {
        onCartChange(cart.filter(item => item.id !== cartId));
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative flex-1">
            {/* Header & Search */}
            <div className="p-6 pb-4 bg-white border-b border-slate-200 shrink-0 z-10 transition-opacity">
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Prescription</h2>
                <p className="text-sm font-semibold text-slate-500 mb-6">Ajout rapide des analyses de biologie.</p>

                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">
                        <Search size={24} />
                    </div>
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        disabled={disabled}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={disabled ? "Sélectionnez un patient d'abord..." : "Rechercher une analyse (Nom, Code)..."}
                        className="w-full pl-12 pr-4 py-4 text-lg bg-white border-2 border-slate-200 rounded-2xl shadow-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-bold text-slate-800 disabled:bg-slate-100 disabled:cursor-not-allowed transition-all"
                    />

                    {/* Auto-complete Dropdown */}
                    {filteredActs.length > 0 && (
                        <div className="absolute top-[105%] left-0 right-0 max-h-80 overflow-y-auto bg-white border-2 border-slate-200 rounded-2xl shadow-xl z-20">
                            {filteredActs.map((act, idx) => (
                                <div 
                                    key={act.id}
                                    onClick={() => handleAddAct(act)}
                                    className={`px-5 py-3 flex items-center justify-between cursor-pointer border-b border-slate-100 last:border-0 hover:bg-emerald-50 ${idx === selectedIndex ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'border-l-4 border-l-transparent'}`}
                                >
                                    <div>
                                        <div className="font-bold text-slate-800">{act.label}</div>
                                        <div className="text-xs font-semibold text-slate-400 mt-0.5">{act.code || 'NO-CODE'}</div>
                                    </div>
                                    <div className="text-emerald-500 opacity-0 group-hover:opacity-100">
                                        <ChevronRight size={18} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Items Area */}
            <div className={`flex-1 overflow-y-auto p-6 transition-all duration-300 ${disabled ? 'opacity-50 grayscale pointer-events-none' : 'opacity-100'}`}>
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <FlaskConical size={64} className="mb-4 opacity-20" />
                        <h3 className="text-xl font-bold uppercase tracking-tight text-slate-300">Panier vide</h3>
                        <p className="mt-2 text-sm text-slate-400">Utilisez la barre de recherche pour ajouter des actes.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-24">
                        {cart.map((item) => (
                            <div key={item.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex items-center shadow-sm group transition-all">
                                <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100 shrink-0">
                                    <FlaskConical size={20} />
                                </div>
                                <div className="ml-4 flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 truncate uppercase text-sm">{item.label}</div>
                                    <div className="text-[10px] font-black tracking-widest text-slate-400 mt-1 uppercase">{item.code || 'B-ACT'}</div>
                                </div>
                                <button 
                                    onClick={() => handleRemove(item.id)}
                                    className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2 opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Overlay if disabled */}
            {disabled && (
                <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[2px] z-30 flex items-center justify-center">
                    <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 flex items-center space-x-4 max-w-sm text-center">
                        <AlertCircle className="text-amber-500 shrink-0" size={32} />
                        <div>
                            <p className="text-sm font-bold text-slate-800">En attente de patient</p>
                            <p className="text-xs text-slate-500 mt-1">Veuillez sélectionner et confirmer un patient dans le panneau de gauche.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
