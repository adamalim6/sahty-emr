import React, { useState, useEffect } from 'react';
import { Network, Search, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { api } from '../../services/api';
import { EMDNNode } from '../../types/emdn';

const LEVEL_COLORS = {
    1: 'bg-indigo-100 text-indigo-700 border-indigo-200', // Category
    2: 'bg-blue-100 text-blue-700 border-blue-200',       // Group
    3: 'bg-sky-100 text-sky-700 border-sky-200',          // Type 1
    4: 'bg-teal-100 text-teal-700 border-teal-200',       // Type 2
    5: 'bg-emerald-100 text-emerald-700 border-emerald-200', // Type 3
    6: 'bg-green-100 text-green-700 border-green-200',    // Type 4
    7: 'bg-lime-100 text-lime-700 border-lime-200',       // Type 5
};

interface EMDNItemProps {
    node: EMDNNode;
    depth?: number;
    language: 'fr' | 'en';
    searchTerm?: string;
}

const EMDNItem: React.FC<EMDNItemProps> = ({ node, depth = 0, language, searchTerm }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    // Auto-expand if search matches children
    useEffect(() => {
        if (searchTerm && hasChildren) {
            const hasMatch = (n: EMDNNode): boolean => {
                const matchSelf = 
                    n.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    n.label_fr?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    n.label_en?.toLowerCase().includes(searchTerm.toLowerCase());
                if (matchSelf) return true;
                return n.children?.some(c => hasMatch(c)) || false;
            };
            if (hasMatch(node)) {
                setIsOpen(true);
            }
        }
    }, [searchTerm, hasChildren, node]);

    const getLevelBadge = (level: number) => {
        const style = LEVEL_COLORS[level as keyof typeof LEVEL_COLORS] || 'bg-slate-100 text-slate-700';
        let label = `NIV ${level}`;
        if (level === 1) label = 'CATÉGORIE';
        if (level === 2) label = 'GROUPE';
        if (level >= 3) label = `TYPE ${level - 2}`;

        return (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${style} uppercase tracking-wider`}>
                {label}
            </span>
        );
    };

    return (
        <div className="select-none">
            <div 
                className={`
                    flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors
                    ${depth === 0 ? 'bg-slate-50/50 mb-1' : ''}
                `}
                style={{ marginLeft: `${depth * 24}px` }}
                onClick={() => hasChildren && setIsOpen(!isOpen)}
            >
                <div className="flex-shrink-0 w-5 text-slate-400">
                    {hasChildren && (
                        isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />
                    )}
                </div>

                <div className={`font-mono font-medium ${depth === 0 ? 'text-lg text-indigo-900' : 'text-slate-700'}`}>
                    {node.code}
                </div>

                <div className="flex-1">
                     <span className={`${depth === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                        {language === 'fr' ? node.label_fr : node.label_en}
                    </span>
                </div>

                {getLevelBadge(node.level)}
            </div>

            {isOpen && hasChildren && (
                <div className="mt-1">
                    {node.children.map(child => (
                        <EMDNItem 
                            key={child.code} 
                            node={child} 
                            depth={depth + 1} 
                            language={language}
                            searchTerm={searchTerm}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const EMDNSandboxPage: React.FC = () => {
    const [tree, setTree] = useState<EMDNNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [language, setLanguage] = useState<'fr' | 'en'>('fr');

    useEffect(() => {
        const loadTree = async () => {
            try {
                const data = await api.getEMDNTree();
                setTree(data);
            } catch (err: any) {
                console.error(err);
                setError("Impossible de charger la classification EMDN.");
            } finally {
                setLoading(false);
            }
        };
        loadTree();
    }, []);

    const filteredTree = tree.filter(node => {
        if (!searchTerm) return true;
        const matches = (n: EMDNNode): boolean => {
            const matchSelf = 
                n.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                n.label_fr?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                n.label_en?.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (matchSelf) return true;
            return n.children?.some(c => matches(c)) || false;
        };
        return matches(node);
    });

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement de la classification EMDN...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Network className="text-teal-600" />
                        Classification EMDN
                    </h1>
                    <p className="text-slate-500">European Medical Device Nomenclature</p>
                </div>
                
                <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                    <button 
                        onClick={() => setLanguage('fr')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${language === 'fr' ? 'bg-teal-100 text-teal-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        FR
                    </button>
                    <button 
                        onClick={() => setLanguage('en')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${language === 'en' ? 'bg-teal-100 text-teal-800' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        EN
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-12rem)]">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Rechercher un code, un terme..." 
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {filteredTree.map(node => (
                        <EMDNItem 
                            key={node.code} 
                            node={node} 
                            language={language} 
                            searchTerm={searchTerm} 
                        />
                    ))}
                    {filteredTree.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            Aucun résultat trouvé pour "{searchTerm}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
