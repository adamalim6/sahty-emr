import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Search, ShieldCheck, Plus, Users as UsersIcon, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
    ACTIVE:     { label: 'Active',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    REPLACED:   { label: 'Remplacée',  color: 'bg-slate-100 text-slate-500 border-slate-200' },
    TERMINATED: { label: 'Terminée',   color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export const CoveragesListPage: React.FC = () => {
    const navigate = useNavigate();
    const [coverages, setCoverages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [organismes, setOrganismes] = useState<any[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({
        organismeId: '',
        policyNumber: '',
        groupNumber: '',
        planName: '',
        coverageTypeCode: '',
        effectiveFrom: '',
        effectiveTo: ''
    });

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.coverages.list({ search: search || undefined, status: statusFilter || undefined });
            setCoverages(data);
        } catch (e: any) {
            toast.error(e.message || 'Erreur de chargement');
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [search, statusFilter]);

    useEffect(() => {
        (async () => {
            try { setOrganismes(await api.getTenantOrganismes()); } catch {}
        })();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.organismeId || !createForm.policyNumber) {
            toast.error('Organisme et numéro de police requis');
            return;
        }
        setCreating(true);
        try {
            const created = await api.coverages.create({
                ...createForm,
                effectiveFrom: createForm.effectiveFrom || undefined,
                effectiveTo: createForm.effectiveTo || undefined
            });
            toast.success('Couverture créée');
            setIsCreateOpen(false);
            setCreateForm({ organismeId: '', policyNumber: '', groupNumber: '', planName: '', coverageTypeCode: '', effectiveFrom: '', effectiveTo: '' });
            navigate(`/coverages/${created.coverage_id}`);
        } catch (e: any) {
            toast.error(e.message || 'Erreur de création');
        } finally { setCreating(false); }
    };

    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Couvertures</h1>
                    <p className="text-slate-500">Registre des polices d'assurance des patients</p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                    <Plus size={20} /><span>Nouvelle couverture</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher par organisme, police, nom..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="">Tous les statuts</option>
                    <option value="ACTIVE">Active</option>
                    <option value="REPLACED">Remplacée</option>
                    <option value="TERMINATED">Terminée</option>
                </select>
            </div>

            {loading && (
                <div className="text-center py-16 text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Chargement...
                </div>
            )}

            {!loading && coverages.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <ShieldCheck className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p className="font-bold text-slate-500">Aucune couverture enregistrée.</p>
                </div>
            )}

            {!loading && coverages.length > 0 && (
                <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <tr>
                                <th className="text-left px-4 py-3">Organisme</th>
                                <th className="text-left px-4 py-3">N° Police</th>
                                <th className="text-left px-4 py-3">Plan</th>
                                <th className="text-center px-4 py-3">Membres</th>
                                <th className="text-left px-4 py-3">Validité</th>
                                <th className="text-left px-4 py-3">Statut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {coverages.map((c: any) => {
                                const badge = STATUS_BADGE[c.status] || { label: c.status, color: 'bg-slate-100 text-slate-500 border-slate-200' };
                                return (
                                    <tr
                                        key={c.coverage_id}
                                        onClick={() => navigate(`/coverages/${c.coverage_id}`)}
                                        className="cursor-pointer hover:bg-indigo-50/30 transition-colors"
                                    >
                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            {c.organisme_designation || <span className="text-slate-400 italic">Inconnu</span>}
                                            {c.organisme_category && (
                                                <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">{c.organisme_category}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-slate-600">{c.policy_number || '—'}</td>
                                        <td className="px-4 py-3 text-slate-600">{c.plan_name || '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1 text-slate-600">
                                                <UsersIcon size={12} className="text-slate-400" /> {c.member_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {fmtDate(c.effective_from)} → {fmtDate(c.effective_to)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${badge.color}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => !creating && setIsCreateOpen(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-slate-800">Nouvelle couverture</h3>
                            <button onClick={() => setIsCreateOpen(false)} disabled={creating} className="text-slate-400 hover:text-slate-600">
                                <X size={22} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Organisme *</label>
                                <select
                                    required
                                    value={createForm.organismeId}
                                    onChange={e => setCreateForm({ ...createForm, organismeId: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    disabled={creating}
                                >
                                    <option value="">Sélectionner...</option>
                                    {organismes.map((o: any) => (
                                        <option key={o.id} value={o.id}>{o.designation}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">N° de police *</label>
                                <input
                                    required
                                    value={createForm.policyNumber}
                                    onChange={e => setCreateForm({ ...createForm, policyNumber: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    disabled={creating}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">N° de groupe</label>
                                    <input
                                        value={createForm.groupNumber}
                                        onChange={e => setCreateForm({ ...createForm, groupNumber: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        disabled={creating}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Plan</label>
                                    <input
                                        value={createForm.planName}
                                        onChange={e => setCreateForm({ ...createForm, planName: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        disabled={creating}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Valide du</label>
                                    <input
                                        type="date"
                                        value={createForm.effectiveFrom}
                                        onChange={e => setCreateForm({ ...createForm, effectiveFrom: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        disabled={creating}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Valide au</label>
                                    <input
                                        type="date"
                                        value={createForm.effectiveTo}
                                        onChange={e => setCreateForm({ ...createForm, effectiveTo: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        disabled={creating}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    disabled={creating}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl disabled:opacity-50"
                                >Annuler</button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                                >
                                    {creating && <Loader2 size={14} className="animate-spin" />} Créer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
