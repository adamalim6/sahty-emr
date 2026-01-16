
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, FlaskConical } from 'lucide-react';
import { DCI, ProductDCIComponent } from '../../types/pharmacy';


interface DCISelectorProps {
    availableDCIs: DCI[];
    value: ProductDCIComponent[];
    onChange: (value: ProductDCIComponent[]) => void;
    onAddNew: () => void;
}

export const DCISelector: React.FC<DCISelectorProps> = ({ 
    availableDCIs, 
    value, 
    onChange,
    onAddNew 
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
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

    // Filter DCIs based on search and exclude already selected ones
    const filteredDCIs = availableDCIs.filter(dci => 
        !value.some(item => item.dciId === dci.id) && (
            dci.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dci.atc_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dci.synonyms?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    ).slice(0, 10); // Limit to 10 results for performance/UI

    const handleSelect = (dciId: string) => {
        onChange([...value, { dciId, dosage: 0, unit: 'mg' as const }]);
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
                    const dci = availableDCIs.find(d => d.id === item.dciId);
                    if (!dci) return null;

                    return (
                        <div key={item.dciId} className="bg-white border border-slate-200 text-slate-700 p-2 rounded-md shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="font-medium flex-1 truncate">{dci.name}</span>
                                
                                {/* Dosage Input - Hide if complex presentation is active */}
                                {!item.presentation && (
                                    <input 
                                        type="number" 
                                        className={`w-20 px-2 py-1 border rounded text-sm outline-none focus:ring-2 focus:ring-purple-500 ${!item.dosage || item.dosage <= 0 ? 'border-red-300' : 'border-slate-300'}`}
                                        placeholder="Dose"
                                        value={item.dosage || ''}
                                        onChange={e => handleUpdate(item.dciId, 'dosage', parseFloat(e.target.value))}
                                        min={0}
                                    />
                                )}

                            {/* Unit Select */}
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

                                        handleUpdate(item.dciId, 'presentation', {
                                            numerator: num,
                                            denominator: 1, // Default
                                            numeratorUnit: numUnit,
                                            denominatorUnit: 'ml'
                                        });
                                        // Recalculate canonical
                                        handleUpdate(item.dciId, 'unit', canonUnit as any);
                                        handleUpdate(item.dciId, 'dosage', num);
                                    } else {
                                        // Switch back to simple
                                        handleUpdate(item.dciId, 'unit', val);
                                        // Clear presentation
                                        const updated = value.map(i => i.dciId === item.dciId ? { ...i, unit: val as any, presentation: undefined } : i);
                                        onChange(updated);
                                        return; 
                                    }
                                }}
                            >
                                <optgroup label="Standard">
                                    <option value="mg">mg</option>
                                    <option value="g">g</option>
                                    <option value="mcg">mcg</option>
                                    <option value="ng">ng</option>
                                    <option value="kg">kg</option>
                                    <option value="ml">ml</option>
                                    <option value="IU">IU</option>
                                    <option value="mIU">mIU</option>
                                    <option value="kIU">kIU</option>
                                    <option value="U">U</option>
                                    <option value="mU">mU</option>
                                    <option value="kU">kU</option>
                                    <option value="%">%</option>
                                </optgroup>

                                <optgroup label="Concentration">
                                    <option value="mg/mL">mg/mL</option>
                                    <option value="mcg/mL">mcg/mL</option>
                                    <option value="ng/mL">ng/mL</option>
                                    <option value="g/L">g/L</option>
                                    <option value="g/mL">g/mL</option>
                                    <option value="IU/mL">IU/mL</option>
                                    <option value="mIU/mL">mIU/mL</option>
                                    <option value="U/mL">U/mL</option>
                                    <option value="mmol/L">mmol/L</option>
                                    <option value="µmol/L">µmol/L</option>
                                    <option value="mEq/L">mEq/L</option>
                                </optgroup>

                                <optgroup label="Ratio Complexe">
                                    <option value="COMPLEX_MG_ML">(x)mg / (y)ml</option>
                                    <option value="COMPLEX_MCG_ML">(x)mcg / (y)ml</option>
                                    <option value="COMPLEX_G_ML">(x)g / (y)ml</option>
                                </optgroup>
                                
                                <optgroup label="Poids/Surface">
                                    <option value="mg/kg">mg/kg</option>
                                    <option value="mcg/kg">mcg/kg</option>
                                    <option value="IU/kg">IU/kg</option>
                                    <option value="mg/kg/day">mg/kg/day</option>
                                    <option value="mcg/kg/day">mcg/kg/day</option>

                                    <option value="mg/m²">mg/m²</option>
                                    <option value="mcg/m²">mcg/m²</option>
                                </optgroup>

                                <optgroup label="Dose">
                                    <option value="mg/dose">mg/dose</option>
                                    <option value="mcg/dose">mcg/dose</option>
                                    <option value="mL/dose">mL/dose</option>
                                </optgroup>
                            </select>

                            <button 
                                type="button"
                                onClick={() => handleRemove(item.dciId)}
                                className="text-slate-400 hover:text-red-500 transition-colors ml-1 p-1"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        
                        {/* Complex Dosage Input Row */}
                        {item.presentation && (
                             <div className="ml-2 mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs flex items-center gap-2">
                                <span className="text-slate-500 italic">Ratio:</span>
                                <input 
                                    type="number"
                                    className="w-16 px-1 py-0.5 border border-slate-300 rounded outline-none"
                                    value={item.presentation.numerator}
                                    onChange={e => {
                                        const n = parseFloat(e.target.value) || 0;
                                        const d = item.presentation?.denominator || 1;
                                        const newPres = { ...item.presentation!, numerator: n };
                                        
                                        // Calculate canonical
                                        let canonUnit = 'mg/mL';
                                        if (newPres.numeratorUnit === 'mcg') canonUnit = 'mcg/mL';
                                        if (newPres.numeratorUnit === 'g') canonUnit = 'g/mL';

                                        const updated = value.map(i => i.dciId === item.dciId ? { 
                                            ...i, 
                                            presentation: newPres,
                                            dosage: parseFloat((n / d).toFixed(4)), 
                                            unit: canonUnit as any 
                                        } : i);
                                        onChange(updated);
                                    }}
                                />
                                <span className="text-slate-600 font-medium uppercase">{item.presentation.numeratorUnit}</span>
                                <span className="text-slate-400">/</span>
                                <input 
                                    type="number"
                                    className="w-16 px-1 py-0.5 border border-slate-300 rounded outline-none"
                                    value={item.presentation.denominator}
                                    onChange={e => {
                                        const d = parseFloat(e.target.value) || 1;
                                        const n = item.presentation?.numerator || 0;
                                        const newPres = { ...item.presentation!, denominator: d };
                                        
                                        let canonUnit = 'mg/mL';
                                        if (newPres.numeratorUnit === 'mcg') canonUnit = 'mcg/mL';
                                        if (newPres.numeratorUnit === 'g') canonUnit = 'g/mL';

                                        const updated = value.map(i => i.dciId === item.dciId ? { 
                                            ...i, 
                                            presentation: newPres,
                                            dosage: parseFloat((n / d).toFixed(4)),
                                            unit: canonUnit as any
                                        } : i);
                                        onChange(updated);
                                    }}
                                />
                                <span className="text-slate-600 font-medium uppercase">{item.presentation.denominatorUnit}</span>
                                
                                <span className="ml-auto text-slate-400 text-[10px] flex items-center gap-1">
                                    <span>Équivalent:</span>
                                    <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">
                                        {item.dosage} {item.unit}
                                    </span>
                                </span>
                             </div>
                        )}
                        </div>
                    );
                })}
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text"
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Rechercher une DCI à ajouter..."
                    value={searchQuery}
                    onChange={e => {
                        setSearchQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />

                {/* Dropdown Results */}
                {isOpen && searchQuery && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredDCIs.length > 0 ? (
                            filteredDCIs.map(dci => (
                                <button
                                    key={dci.id}
                                    type="button"
                                    onClick={() => handleSelect(dci.id)}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex flex-col border-b border-slate-50 last:border-0"
                                >
                                    <span className="font-medium text-slate-800 text-sm">{dci.name}</span>
                                    <div className="flex gap-2 text-xs text-slate-500">
                                        {dci.atc_code && <span>ATC: {dci.atc_code}</span>}
                                        {dci.therapeutic_class && <span>Class: {dci.therapeutic_class}</span>}
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="p-4 text-center text-sm text-slate-500">
                                Aucune DCI trouvée. 
                                <button onClick={onAddNew} className="text-purple-600 hover:underline ml-1">
                                    En créer une ?
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <p className="text-xs text-slate-500 mt-2">
                Recherchez et sélectionnez les substances actives composant ce médicament.
            </p>
        </div>
    );
};
