
import React, { useState, useEffect } from 'react';
import { ATCNode } from '../../types/atc';
import { ChevronRight, ChevronDown, Folder, FileText, Search } from 'lucide-react';

const getLevelStyles = (level: number) => {
    switch (level) {
        case 1: return { icon: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', active: 'bg-indigo-50' };
        case 2: return { icon: 'text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200', active: 'bg-blue-50' };
        case 3: return { icon: 'text-sky-600', badge: 'bg-sky-50 text-sky-700 border-sky-200', active: 'bg-sky-50' };
        case 4: return { icon: 'text-teal-600', badge: 'bg-teal-50 text-teal-700 border-teal-200', active: 'bg-teal-50' };
        case 5: return { icon: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-50' };
        default: return { icon: 'text-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200', active: 'bg-slate-50' };
    }
};

const ATCItem: React.FC<{ node: ATCNode; level: number; language: 'fr' | 'en'; searchTerm: string }> = ({ node, level, language, searchTerm }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const styles = getLevelStyles(node.level);

    useEffect(() => {
        if (searchTerm) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [searchTerm]);

    return (
        <div className="select-none">
            <div 
                className={`flex items-center py-1 px-2 hover:bg-slate-50 cursor-pointer rounded transition-colors ${node.level === 1 ? 'mb-1 mt-1' : ''}`}
                style={{ paddingLeft: `${(level - 1) * 20}px` }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="mr-2 text-slate-300 w-5 flex-shrink-0">
                    {hasChildren ? (
                        isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    ) : <span className="w-4 h-4" />}
                </div>
                
                <div className={`mr-3 w-5 flex-shrink-0 ${styles.icon}`}>
                    {node.level < 5 ? (
                         isOpen ? <Folder size={18} fill="currentColor" className="opacity-20" /> : <Folder size={18} />
                    ) : (
                        <FileText size={16} />
                    )}
                </div>

                <div className="flex items-center space-x-3">
                    <span className={`font-mono text-xs px-2 py-0.5 rounded border min-w-[55px] text-center font-medium ${styles.badge}`}>
                        {node.code}
                    </span>
                    <span className={`text-sm ${node.level === 1 ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                        {language === 'fr' ? (node.label_fr || node.label_en || 'Sans Nom') : (node.label_en || node.label_fr || 'Unnamed')}
                    </span>
                    {node.level === 5 && (
                        <span className="text-[10px] uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-100">
                            MOLECULE
                        </span>
                    )}
                </div>
            </div>

            {isOpen && hasChildren && (
                <div className="border-l border-slate-100 ml-4">
                    {node.children.map(child => (
                        <ATCItem key={child.code} node={child} level={level + 1} language={language} searchTerm={searchTerm} />
                    ))}
                </div>
            )}
        </div>
    );
};

import { api } from '../../services/api';

// ...

export const ATCSandboxPage: React.FC = () => {
    const [tree, setTree] = useState<ATCNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [language, setLanguage] = useState<'fr' | 'en'>('fr');

    useEffect(() => {
        const fetchTree = async () => {
            console.log('Fetching ATC Tree...');
            try {
                // Use the configured API client
                const data = await api.getATCTree();
                
                console.log('Tree data received:', data ? data.length + ' roots' : 'No data');
                
                // Unwrap the root 'ATC' node if present, as requested by user
                if (data.length === 1 && data[0].code === 'ATC') {
                    setTree(data[0].children || []);
                } else {
                    setTree(data);
                }
            } catch (err: any) {
                console.error('ATC Fetch Error:', err);
                setError(err.message || 'Failed to fetch tree');
            } finally {
                setLoading(false);
            }
        };

        fetchTree();
    }, []);

    const filterNodes = (nodes: ATCNode[], term: string): ATCNode[] => {
        if (!term) return nodes;
        const lowerTerm = term.toLowerCase();
        
        return nodes.reduce((acc: ATCNode[], node) => {
            const matches = 
                node.code.toLowerCase().includes(lowerTerm) || 
                (node.label_fr && node.label_fr.toLowerCase().includes(lowerTerm)) ||
                (node.label_en && node.label_en.toLowerCase().includes(lowerTerm));
            
            const filteredChildren = filterNodes(node.children || [], term);
            
            if (matches || filteredChildren.length > 0) {
                acc.push({
                    ...node,
                    children: filteredChildren
                });
            }
            
            return acc;
        }, []);
    };

    console.log('Searching for:', searchTerm);
    const displayTree = searchTerm ? filterNodes(tree, searchTerm) : tree;
    console.log('Display nodes count:', displayTree.length);

    return (
        <div className="p-6 max-w-6xl mx-auto h-[calc(100vh-64px)] flex flex-col">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Classification ATC (Sandbox)</h1>
                    <p className="text-slate-500">Explorateur hiérarchique de terminologie médicale</p>
                </div>
                
                <div className="flex items-center space-x-4">
                     <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200">
                        <button 
                            onClick={() => setLanguage('fr')}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${language === 'fr' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            FR
                        </button>
                        <button 
                            onClick={() => setLanguage('en')}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${language === 'en' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            EN
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder={language === 'fr' ? "Rechercher code ou libellé..." : "Search code or label..."} 
                            className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg w-80 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loading && <div className="text-center py-10 text-slate-500">Chargement de la nomenclature...</div>}
            
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    Erreur: {error}
                </div>
            )}

            {!loading && !error && (
                <div className="flex-1 bg-white rounded-xl shadow border border-slate-200 overflow-y-auto p-4 custom-scrollbar">
                    {displayTree.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic">Aucun résultat trouvé.</div>
                    ) : (
                        displayTree.map(node => (
                            <ATCItem key={node.code} node={node} level={1} language={language} searchTerm={searchTerm} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
