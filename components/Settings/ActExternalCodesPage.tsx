import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import { Plus, Pencil, Trash2, Search, Link2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface ExternalCode {
    id: string;
    global_act_id: string;
    external_system_id: string;
    external_code: string;
    is_active: boolean;
    system_code: string;
    system_label: string;
    act_label: string;
    act_code: string;
}

interface ExternalSystem {
    id: string;
    code: string;
    label: string;
    is_active: boolean;
}

interface GlobalAct {
    id: string;
    label: string;
    code: string;
}

export const ActExternalCodesPage: React.FC = () => {
    const [codes, setCodes] = useState<ExternalCode[]>([]);
    const [systems, setSystems] = useState<ExternalSystem[]>([]);
    const [filterSystem, setFilterSystem] = useState('');
    const [searchText, setSearchText] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<ExternalCode | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formSystemId, setFormSystemId] = useState('');
    const [formExternalCode, setFormExternalCode] = useState('');
    const [formActive, setFormActive] = useState(true);

    // Act autocomplete
    const [actSearch, setActSearch] = useState('');
    const [actResults, setActResults] = useState<GlobalAct[]>([]);
    const [selectedAct, setSelectedAct] = useState<GlobalAct | null>(null);
    const [showActDropdown, setShowActDropdown] = useState(false);
    const actSearchRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => { loadData(); }, [filterSystem]);

    const loadData = async () => {
        try {
            const [codesData, systemsData] = await Promise.all([
                api.getGlobalActExternalCodes(filterSystem ? { external_system_id: filterSystem } : undefined),
                api.getExternalSystems()
            ]);
            setCodes(codesData);
            setSystems(systemsData.filter((s: ExternalSystem) => s.is_active));
        } catch (e: any) {
            toast.error('Erreur lors du chargement');
        }
    };

    // Act search — fetch LIMS-enabled global_actes from reference
    const searchActs = useCallback(async (query: string) => {
        if (query.length < 2) { setActResults([]); return; }
        try {
            const res = await api.getTenantActes({ search: query, limit: 20 });
            // getTenantActes may return { data: [...] } or [...] — handle both
            const items = Array.isArray(res) ? res : (res.data || []);
            setActResults(items);
        } catch { setActResults([]); }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => searchActs(actSearch), 300);
        return () => clearTimeout(timer);
    }, [actSearch, searchActs]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowActDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const openCreate = () => {
        setEditing(null);
        setFormSystemId(filterSystem || (systems[0]?.id || ''));
        setFormExternalCode('');
        setFormActive(true);
        setSelectedAct(null);
        setActSearch('');
        setIsModalOpen(true);
    };

    const openEdit = (code: ExternalCode) => {
        setEditing(code);
        setFormSystemId(code.external_system_id);
        setFormExternalCode(code.external_code);
        setFormActive(code.is_active);
        setSelectedAct({ id: code.global_act_id, label: code.act_label, code: code.act_code });
        setActSearch(code.act_label);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!selectedAct || !formSystemId || !formExternalCode.trim()) {
            toast.error('Tous les champs sont requis');
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await api.updateGlobalActExternalCode(editing.id, {
                    external_code: formExternalCode,
                    is_active: formActive
                });
                toast.success('Mapping mis à jour');
            } else {
                await api.createGlobalActExternalCode({
                    global_act_id: selectedAct.id,
                    external_system_id: formSystemId,
                    external_code: formExternalCode,
                    is_active: formActive
                });
                toast.success('Mapping créé');
            }
            setIsModalOpen(false);
            loadData();
        } catch (e: any) {
            toast.error(e.message || 'Erreur');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (code: ExternalCode) => {
        if (!confirm(`Supprimer le mapping "${code.act_label}" → "${code.external_code}" ?`)) return;
        try {
            await api.deleteGlobalActExternalCode(code.id);
            toast.success('Mapping supprimé');
            loadData();
        } catch (e: any) {
            toast.error(e.message || 'Erreur');
        }
    };

    const filtered = codes.filter(c => {
        if (!searchText) return true;
        const q = searchText.toLowerCase();
        return c.act_label?.toLowerCase().includes(q) ||
               c.act_code?.toLowerCase().includes(q) ||
               c.external_code?.toLowerCase().includes(q) ||
               c.system_code?.toLowerCase().includes(q);
    });

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Actes & Codes Externes</h1>
                    <p className="text-slate-500">Mapping des actes vers les systèmes externes</p>
                </div>
                <button
                    onClick={openCreate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <Plus size={20} />
                    <span>Nouveau Mapping</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        placeholder="Rechercher acte, code externe..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                </div>
                <select
                    value={filterSystem}
                    onChange={e => setFilterSystem(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-400 min-w-[200px]"
                >
                    <option value="">Tous les systèmes</option>
                    {systems.map(s => (
                        <option key={s.id} value={s.id}>{s.code} — {s.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Acte</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Système</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Code Externe</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    <Link2 size={36} className="mx-auto mb-3 text-slate-300" />
                                    <p className="font-medium">Aucun mapping configuré</p>
                                    <p className="text-sm mt-1">Cliquez sur "Nouveau Mapping" pour associer un acte à un code externe</p>
                                </td>
                            </tr>
                        ) : filtered.map(code => (
                            <tr key={code.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="text-sm font-medium text-slate-800">{code.act_label}</div>
                                        {code.act_code && (
                                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{code.act_code}</div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                        {code.system_code}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-mono font-bold text-sm text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                                        {code.external_code}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {code.is_active ? (
                                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">Actif</span>
                                    ) : (
                                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">Inactif</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => openEdit(code)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                                            <Pencil size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(code)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="bg-slate-800 px-6 py-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">{editing ? 'Modifier le Mapping' : 'Nouveau Mapping'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Act autocomplete */}
                            <div ref={dropdownRef} className="relative">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Acte</label>
                                {editing ? (
                                    <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                                        {selectedAct?.label}
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            ref={actSearchRef}
                                            type="text"
                                            value={actSearch}
                                            onChange={e => { setActSearch(e.target.value); setShowActDropdown(true); setSelectedAct(null); }}
                                            onFocus={() => setShowActDropdown(true)}
                                            placeholder="Rechercher un acte..."
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                        {selectedAct && (
                                            <div className="mt-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-800 flex items-center justify-between">
                                                <span>{selectedAct.label}</span>
                                                <button onClick={() => { setSelectedAct(null); setActSearch(''); }} className="text-blue-400 hover:text-blue-600">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}
                                        {showActDropdown && actResults.length > 0 && !selectedAct && (
                                            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {actResults.map((act: any) => (
                                                    <button
                                                        key={act.id}
                                                        onClick={() => {
                                                            setSelectedAct(act);
                                                            setActSearch(act.label);
                                                            setShowActDropdown(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-slate-50 last:border-b-0"
                                                    >
                                                        <div className="font-medium text-slate-800">{act.label}</div>
                                                        {act.code && <div className="text-[10px] text-slate-400 font-mono">{act.code}</div>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* System select */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Système Externe</label>
                                <select
                                    value={formSystemId}
                                    onChange={e => setFormSystemId(e.target.value)}
                                    disabled={!!editing}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
                                >
                                    <option value="">Sélectionner...</option>
                                    {systems.map(s => (
                                        <option key={s.id} value={s.id}>{s.code} — {s.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* External code */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Code Externe</label>
                                <input
                                    type="text"
                                    value={formExternalCode}
                                    onChange={e => setFormExternalCode(e.target.value)}
                                    placeholder="ex: GLUC, HBA1C, TSH..."
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            {/* Active toggle */}
                            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <span className="text-sm font-medium text-slate-700">Actif</span>
                                <button
                                    onClick={() => setFormActive(!formActive)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${formActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !selectedAct || !formSystemId || !formExternalCode.trim()}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Check size={16} />
                                {editing ? 'Modifier' : 'Créer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
