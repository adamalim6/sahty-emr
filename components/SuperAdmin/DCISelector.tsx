import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, FlaskConical } from 'lucide-react';
import { DCI, ProductDCIComponent } from '../../types/pharmacy';
import { api } from '../../services/api';

interface DCISelectorProps {
    // availableDCIs: DCI[]; // REMOVED: Managed internally via async search
    value: ProductDCIComponent[];
    onChange: (value: ProductDCIComponent[]) => void;
    onAddNew: () => void;
}

export const DCISelector: React.FC<DCISelectorProps> = ({ 
    value, 
    onChange,
    onAddNew 
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [searchResults, setSearchResults] = useState<DCI[]>([]);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Async Search
    useEffect(() => {
        if (!searchQuery) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                // Use the paginated API for search (limit 20)
                const res: any = await api.getGlobalDCIs({ q: searchQuery, limit: 20 });
                if (res.data) {
                     setSearchResults(res.data);
                } else {
                    setSearchResults([]);
                }
            } catch (error) {
                console.error("Failed to search DCIs", error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);


    const handleSelect = (dci: DCI) => {
        onChange([...value, { 
            dciId: dci.id, 
            name: dci.name, 
            atcCode: dci.atc_code, // Store ATC Code
            dosage: 0, 
            unit: 'mg' as const 
        }]);
        setSearchQuery('');
        setIsOpen(false);
    };

    const handleRemove = (dciId: string) => {
        onChange(value.filter(item => item.dciId !== dciId));
    };

    const handleUpdate = (dciId: string, field: keyof ProductDCIComponent, newVal: any) => {
        onChange(value.map(item => {
            if (item.dciId === dciId) {
                return { ...item, [field]: newVal };
            }
            return item;
        }));
    };

    return (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200" ref={wrapperRef}>
            <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FlaskConical size={16} className="text-purple-600" />
                    Composition DCI (Obligatoire)
                </label>
                <button 
                    type="button"
                    onClick={onAddNew}
                    className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1 shadow-sm"
                >
                    <Plus size={14} />
                    Ajouter DCI
                </button>
            </div>

            {/* Selected Rows */}
            <div className="space-y-2 mb-3">
                {value.map(item => {
                    return (
                        <div key={item.dciId} className="bg-white border border-slate-200 text-slate-700 p-2 rounded-md shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="font-medium flex-1 truncate">
                                    {item.name || 'DCI Sans Nom'}
                                    {item.atcCode && (
                                        <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                            {item.atcCode}
                                        </span>
                                    )}
                                     {/* We don't have the ATC code easily available here unless we store it too or look it up.
                                        But wait, user asked "display dci code with the name".
                                        The DCI object has `dci.id` but usually ATC code is relevant. 
                                        But `item` is `ProductDCIComponent` which only has `dciId`.
                                        We cannot display ATC code unless we persist it in ProductDefinition too.
                                        
                                        Wait, `dciId` MIGHT be displayed? No, user usually means ATC or just the name.
                                        "display dci code with the name" -> Maybe DCI ID?
                                        
                                        If the user means ATC code, I need to add `atcCode` to `ProductDCIComponent` as enriched field.
                                        Let's assume name is enough for now OR try to fetch it?
                                        Actually, my previous enrichment logic in backend ONLY added `name`. 
                                        I should verify if I need to enrich `atcCode` too.
                                        
                                        Let's stick to Name for now, ensuring it works. 
                                        If user insists on Code, I will add it to enrichment.
                                     */}
                                </span>
                                
                                {/* Dosage Input - Hide if complex presentation is active */}
                                {/* Dosage Input - Always Visible (Numerator for Complex) */}
                                <input 
                                    type="number" 
                                    className={`w-20 px-2 py-1 border rounded text-sm outline-none focus:ring-2 focus:ring-purple-500 ${(!item.dosage && !item.presentation?.numerator) ? 'border-red-300' : 'border-slate-300'}`}
                                    placeholder="Dose"
                                    value={item.presentation ? (item.presentation.numerator || '') : (item.dosage || '')}
                                    onChange={e => {
                                        const newVal = parseFloat(e.target.value);
                                        // Handle NaN
                                        if (isNaN(newVal)) return; // Or handle empty

                                        let updatedItem = { ...item };
                                        
                                        if (updatedItem.presentation) {
                                            // Complex mode: Update numerator
                                            updatedItem.presentation = { ...updatedItem.presentation, numerator: newVal };
                                            // Recalculate canonical dosage
                                            const denom = updatedItem.presentation.denominator || 1;
                                            updatedItem.dosage = newVal / denom;
                                        } else {
                                            // Simple mode
                                            updatedItem.dosage = newVal;
                                        }
                                        
                                        onChange(value.map(i => i.dciId === item.dciId ? updatedItem : i));
                                    }}
                                    min={0}
                                />
                                
                                {/* Unit Selector */}
                                <select 
                                    className="w-24 px-2 py-1 border border-slate-300 rounded text-sm outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                    value={(() => {
                                        if (item.presentation) {
                                            if (item.presentation.numeratorUnit === 'mg') return 'COMPLEX_MG_ML';
                                            if (item.presentation.numeratorUnit === 'mcg') return 'COMPLEX_MCG_ML';
                                            if (item.presentation.numeratorUnit === 'g') return 'COMPLEX_G_ML';
                                            return 'COMPLEX_MG_ML'; 
                                        }
                                        return item.unit;
                                    })()}
                                    onChange={e => {
                                        const val = e.target.value;
                                        let updatedItem = { ...item };

                                        if (val.startsWith('COMPLEX')) {
                                            // Initialize complex mode
                                            const num = item.dosage || 0;
                                            let numUnit = 'mg';
                                            let canonUnit = 'mg/mL';
                                            
                                            if (val === 'COMPLEX_MCG_ML') {
                                                numUnit = 'mcg';
                                                canonUnit = 'mcg/mL';
                                            } else if (val === 'COMPLEX_G_ML') {
                                                numUnit = 'g';
                                                canonUnit = 'g/mL';
                                            }

                                            updatedItem.presentation = {
                                                numerator: num,
                                                denominator: 1, // Default
                                                numeratorUnit: numUnit,
                                                denominatorUnit: 'ml'
                                            };
                                            updatedItem.unit = canonUnit as any;
                                            updatedItem.dosage = num;
                                        } else {
                                            // Switch back to simple
                                            updatedItem.unit = val as any;
                                            delete updatedItem.presentation;
                                        }

                                        // Atomic update
                                        onChange(value.map(i => i.dciId === item.dciId ? updatedItem : i));
                                    }}
                                >
                                    <optgroup label="Standard">
                                        <option value="mg">mg</option>
                                        <option value="g">g</option>
                                        <option value="mcg">mcg</option>
                                        <option value="ml">ml</option>
                                        <option value="IU">IU</option>
                                        <option value="%">%</option>
                                    </optgroup>
                                    <optgroup label="Complexe (Sirop/Injectable)">
                                        <option value="COMPLEX_MG_ML">mg / _ ml</option>
                                        <option value="COMPLEX_MCG_ML">mcg / _ ml</option>
                                        <option value="COMPLEX_G_ML">g / _ ml</option>
                                    </optgroup>
                                </select>

                                {/* Complex Dosage Inputs */}
                                {item.presentation && (
                                    <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                                         <span className="text-xs text-slate-500">/</span>
                                         <input 
                                            type="number" 
                                            className="w-12 px-1 py-0.5 border border-purple-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-500"
                                            value={item.presentation.denominator}
                                            onChange={e => {
                                                const denom = parseFloat(e.target.value);
                                                const pres = item.presentation!; // safe
                                                
                                                // Update presentation
                                                handleUpdate(item.dciId, 'presentation', { ...pres, denominator: denom });

                                                // Update Canonical Dosage = Num / Denom
                                                // e.g. 15mg / 5ml = 3 mg/ml
                                                const canonical = pres.numerator / (denom || 1);
                                                handleUpdate(item.dciId, 'dosage', canonical);
                                            }}
                                         />
                                         <span className="text-xs font-mono text-purple-700">ml</span>
                                    </div>
                                )}

                                <button 
                                    type="button"
                                    onClick={() => handleRemove(item.dciId)}
                                    className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
                {value.length === 0 && (
                    <div className="text-sm text-slate-400 italic text-center py-2 border border-dashed border-slate-300 rounded">
                        Aucune DCI associée
                    </div>
                )}
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Ajouter une DCI (Rechercher...)" 
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                    value={searchQuery}
                    onChange={e => {
                        setSearchQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />

                {/* Dropdown */}
                {isOpen && searchQuery && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {loading ? (
                            <div className="p-3 text-center text-slate-400 text-sm">Recherche...</div>
                        ) : searchResults.length > 0 ? (
                            searchResults
                                .filter(dci => !value.some(v => v.dciId === dci.id)) // Filter out already selected
                                .map(dci => (
                                <button
                                    key={dci.id}
                                    type="button"
                                    onClick={() => handleSelect(dci)}
                                    className="w-full text-left px-4 py-2 hover:bg-purple-50 flex flex-col border-b border-slate-50 last:border-0"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-slate-700 text-sm">{dci.name}</span>
                                        {dci.atcCode && (
                                            <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                                {dci.atcCode}
                                            </span>
                                        )}
                                    </div>
                                    {/* Synonyms? {dci.synonyms?.join(', ')} */}
                                </button>
                            ))
                        ) : (
                            <div className="p-3 text-center text-slate-400 text-sm">
                                Aucune DCI trouvée. <button type="button" onClick={onAddNew} className="text-purple-600 underline">En créér une ?</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
