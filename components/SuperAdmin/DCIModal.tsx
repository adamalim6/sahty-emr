
import React, { useState, useEffect } from 'react';
import { FlaskConical, Save, X } from 'lucide-react';
import { api } from '../../services/api';
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
    const [synonyms, setSynonyms] = useState(''); 
    const [therapeuticClass, setTherapeuticClass] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
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
        fetchTree();
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
                setAtcCode(editingDCI.atc_code || '');
                setSynonyms(editingDCI.synonyms?.join(', ') || '');
                setTherapeuticClass(editingDCI.therapeutic_class || '');
            } else {
                setName('');
                setAtcCode('');
                setSynonyms('');
                setTherapeuticClass('');
            }
        }
    }, [isOpen, editingDCI]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const payload = {
            name,
            atc_code: atcCode,
            synonyms: synonyms.split(',').map(s => s.trim()).filter(s => s.length > 0),
            therapeutic_class: therapeuticClass
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
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
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
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Code ATC</label>
                            <input 
                                type="text" 
                                className={`w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 ${editingDCI ? 'bg-slate-50 text-slate-500' : ''}`}
                                value={atcCode}
                                onChange={e => setAtcCode(e.target.value)}
                                readOnly={!!editingDCI}
                                placeholder="ex: N02BE01"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700">Classification</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-slate-500"
                                value={therapeuticClass}
                                readOnly
                                title="Calculé automatiquement selon le code ATC"
                                placeholder="Auto-population..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">Synonymes</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                            value={synonyms}
                            onChange={e => setSynonyms(e.target.value)}
                            placeholder="ex: Acetaminophen, Doliprane..."
                        />
                        <p className="text-xs text-slate-500 mt-1">Séparés par des virgules.</p>
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
                            disabled={loading}
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
