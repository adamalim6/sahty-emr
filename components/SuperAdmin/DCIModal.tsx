
import React, { useState, useEffect } from 'react';
import { FlaskConical, Save, X, Plus, Trash2 } from 'lucide-react';
import { api, CareCategory } from '../../services/api';
import { DCI } from '../../types/pharmacy';
import { ATCNode } from '../../types/atc';

interface DCIModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (dci: DCI) => void;
    editingDCI?: DCI | null;
}

export const DCIModal: React.FC<DCIModalProps> = ({ isOpen, onClose, onSuccess, editingDCI }) => {
    const [name, setName] = useState('');
    const [atcCode, setAtcCode] = useState('');
    const [synonyms, setSynonyms] = useState<string[]>([]);
    const [therapeuticClass, setTherapeuticClass] = useState('');
    const [careCategoryId, setCareCategoryId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Care Categories Logic
    const [careCategories, setCareCategories] = useState<CareCategory[]>([]);
    const [isCareCategoryOpen, setIsCareCategoryOpen] = useState(false);
    const [careCategorySearch, setCareCategorySearch] = useState('');
    const careCategoryRef = React.useRef<HTMLDivElement>(null);

    // ATC Logic
    const [atcTree, setATCTree] = useState<ATCNode[]>([]);

    useEffect(() => {
        const fetchTree = async () => {
            try {
                const tree = await api.getATCTree();
                setATCTree(tree);
            } catch (err) {
                console.error('Failed to load ATC tree', err);
            }
        };
        const fetchCategories = async () => {
            try {
                const categories = await api.getCareCategories();
                setCareCategories(categories.filter(c => c.isActive !== false));
            } catch (err) {
                console.error('Failed to load care categories', err);
            }
        };
        fetchTree();
        fetchCategories();
    }, []);

    const findClassification = (code: string, nodes: ATCNode[], path: string[] = []): string | null => {
        for (const node of nodes) {
            // Keep track of useful levels (2,3,4) for the label path
            const currentPath = [...path];
            if (node.level >= 2 && node.level <= 4) {
                 const label = node.label_fr || node.label_en || node.code;
                 currentPath.push(label);
            }

            if (node.code === code) {
                // Found it! Join the path
                return currentPath.join(' > ');
            }

            if (node.children && node.children.length > 0) {
                 const found = findClassification(code, node.children, currentPath);
                 if (found) return found;
            }
        }
        return null;
    };

    // Auto-populate Classification when ATC Code changes
    useEffect(() => {
        if (atcCode && atcCode.length >= 5 && atcTree.length > 0) {
             const classification = findClassification(atcCode, atcTree);
             if (classification) {
                 setTherapeuticClass(classification);
             }
        }
    }, [atcCode, atcTree]);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (editingDCI) {
                setName(editingDCI.name);
                setAtcCode(editingDCI.atcCode || '');
                setSynonyms(editingDCI.synonyms?.map(s => typeof s === 'string' ? s : (s as any).synonym) || []);
                setTherapeuticClass(editingDCI.therapeuticClass || '');
                setCareCategoryId(editingDCI.careCategoryId || '');
            } else {
                setName('');
                setAtcCode('');
                setSynonyms([]);
                setTherapeuticClass('');
                setCareCategoryId('');
            }
        }
    }, [isOpen, editingDCI]);

    // Close Care Category dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (careCategoryRef.current && !careCategoryRef.current.contains(event.target as Node)) {
                setIsCareCategoryOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [careCategoryRef]);

    const filteredCareCategories = careCategories.filter(cat => 
        cat.label.toLowerCase().includes(careCategorySearch.toLowerCase()) || 
        cat.code.toLowerCase().includes(careCategorySearch.toLowerCase())
    );

    // Flatten ATC Tree to get Level 5 nodes for selection
    const [selectableATCs, setSelectableATCs] = useState<{ code: string, label: string }[]>([]);
    const [isATCParamOpen, setIsATCParamOpen] = useState(false);
    const [atcSearch, setAtcSearch] = useState('');
    const atcDropdownRef = React.useRef<HTMLDivElement>(null);

    // Close ATC dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (atcDropdownRef.current && !atcDropdownRef.current.contains(event.target as Node)) {
                setIsATCParamOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [atcDropdownRef]);

    useEffect(() => {
        if (atcTree.length > 0) {
            const level5: { code: string, label: string }[] = [];
            const traverse = (nodes: ATCNode[]) => {
                for (const node of nodes) {
                    if (node.level === 5) {
                        level5.push({ 
                            code: node.code, 
                            label: node.label_fr || node.label_en || node.code 
                        });
                    }
                    if (node.children) traverse(node.children);
                }
            };
            traverse(atcTree);
            setSelectableATCs(level5);
        }
    }, [atcTree]);

    // Handle ATC Selection
    const handleATCSelect = (code: string) => {
        setAtcCode(code);
        setAtcSearch('');
        setIsATCParamOpen(false);
        // Auto-population of classification is handled by the existing useEffect on atcCode change
    };

    const filteredATCs = selectableATCs.filter(item => 
        item.code.toLowerCase().includes(atcSearch.toLowerCase()) || 
        item.label.toLowerCase().includes(atcSearch.toLowerCase())
    ).slice(0, 50); // Limit results

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const payload: any = { // Relax type for payload matching backend expected DCI partial
            name,
            atcCode: atcCode, // camelCase matching backend
            synonyms: synonyms.map(s => s.trim()).filter(s => s.length > 0),
            therapeuticClass: therapeuticClass,
            careCategoryId: careCategoryId || undefined
        };

        try {
            let result: DCI;
            if (editingDCI) {
                result = await api.updateGlobalDCI(editingDCI.id, payload);
            } else {
                result = await api.createGlobalDCI(payload);
            }
            onSuccess(result);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl overflow-visible">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FlaskConical className="text-purple-600" />
                        {editingDCI ? 'Modifier DCI' : 'Nouvelle DCI'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Nom de la DCI <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            className={`w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 ${editingDCI ? 'bg-slate-50 text-slate-500' : ''}`}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required 
                            readOnly={!!editingDCI}
                            placeholder="ex: Paracétamol"
                        />
                        {!editingDCI && <p className="text-xs text-slate-500 mt-1">Unique, sera normalisé automatiquement (espaces, majuscules).</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative" ref={atcDropdownRef}>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Code ATC <span className="text-red-500">*</span></label>
                            
                            {/* Selected Value Display & Toggle */}
                            <div 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 flex items-center justify-between cursor-pointer hover:border-purple-400 bg-white"
                                onClick={() => setIsATCParamOpen(!isATCParamOpen)}
                            >
                                <span className={atcCode ? "text-slate-900 font-mono" : "text-slate-400"}>
                                    {atcCode || "Sélectionner..."}
                                </span>
                                <span className="text-xs text-slate-400">▼</span>
                            </div>

                            {/* Dropdown */}
                            {isATCParamOpen && (
                                <div className="absolute z-10 w-[300px] mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col left-0">
                                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                                        <input 
                                            type="text"
                                            className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-purple-500"
                                            placeholder="Filtrer (code ou nom)..."
                                            value={atcSearch}
                                            onChange={(e) => setAtcSearch(e.target.value)}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="overflow-y-auto flex-1">
                                        {filteredATCs.length > 0 ? (
                                            filteredATCs.map(item => (
                                                <div 
                                                    key={item.code}
                                                    className={`px-3 py-2 text-sm hover:bg-purple-50 cursor-pointer border-b border-slate-50 last:border-0 ${atcCode === item.code ? 'bg-purple-50 text-purple-700' : 'text-slate-700'}`}
                                                    onClick={() => handleATCSelect(item.code)}
                                                >
                                                    <div className="font-mono font-bold text-xs">{item.code}</div>
                                                    <div className="text-xs truncate" title={item.label}>{item.label}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-slate-400 text-xs italic">
                                                Aucun code trouvé
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Classification</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-slate-500 text-xs"
                                value={therapeuticClass}
                                readOnly
                                title="Calculé automatiquement selon le code ATC"
                                placeholder="Auto-population..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Classe thérapeutique (Catégorie de Soins)</label>
                        <div className="relative" ref={careCategoryRef}>
                            <div 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 flex items-center justify-between cursor-pointer hover:border-purple-400 bg-white"
                                onClick={() => setIsCareCategoryOpen(!isCareCategoryOpen)}
                            >
                                <span className={careCategoryId ? "text-slate-900" : "text-slate-400"}>
                                    {careCategories.find(c => c.id === careCategoryId)?.label || "Sélectionner une classe..."}
                                </span>
                                <span className="text-xs text-slate-400">▼</span>
                            </div>

                            {isCareCategoryOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col">
                                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                                        <input 
                                            type="text"
                                            className="w-full text-sm border border-slate-200 rounded px-2 py-1 outline-none focus:border-purple-500"
                                            placeholder="Filtrer..."
                                            value={careCategorySearch}
                                            onChange={(e) => setCareCategorySearch(e.target.value)}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="overflow-y-auto flex-1">
                                        <div 
                                            className={`px-3 py-2 text-sm hover:bg-purple-50 cursor-pointer border-b border-slate-50 ${!careCategoryId ? 'bg-purple-50 text-purple-700' : 'text-slate-700'}`}
                                            onClick={() => { setCareCategoryId(''); setIsCareCategoryOpen(false); }}
                                        >
                                            <div className="italic">Aucune classe</div>
                                        </div>
                                        {filteredCareCategories.map(item => (
                                            <div 
                                                key={item.id}
                                                className={`px-3 py-2 text-sm hover:bg-purple-50 cursor-pointer border-b border-slate-50 last:border-0 ${careCategoryId === item.id ? 'bg-purple-50 text-purple-700' : 'text-slate-700'}`}
                                                onClick={() => { setCareCategoryId(item.id); setCareCategorySearch(''); setIsCareCategoryOpen(false); }}
                                            >
                                                <div className="font-medium">{item.label}</div>
                                                <div className="text-xs text-slate-500">{item.code}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium mb-1 text-slate-700">Synonymes</label>
                        {synonyms.map((syn, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                                    value={syn}
                                    onChange={(e) => {
                                        const newSyns = [...synonyms];
                                        newSyns[index] = e.target.value;
                                        setSynonyms(newSyns);
                                    }}
                                    placeholder="ex: Acetaminophen"
                                />
                                <button 
                                    type="button"
                                    onClick={() => {
                                        const newSyns = synonyms.filter((_, i) => i !== index);
                                        setSynonyms(newSyns);
                                    }}
                                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        <button 
                            type="button" 
                            onClick={() => setSynonyms([...synonyms, ''])}
                            className="mt-2 text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1 font-medium"
                        >
                            <Plus size={16} /> Ajouter un synonyme
                        </button>
                    </div>

                    <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 mt-6">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                            disabled={loading}
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit" 
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm flex items-center gap-2"
                            disabled={loading || !atcCode}
                        >
                            <Save size={18} />
                            <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
