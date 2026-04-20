import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Plus, Search, DollarSign, MoreHorizontal, Copy, Send, Archive, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Brouillon', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    PUBLISHED: { label: 'Publiée', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    ARCHIVED: { label: 'Archivée', color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export const PricingPage: React.FC = () => {
    const navigate = useNavigate();
    const [lists, setLists] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ code: '', name: '', description: '', currency_code: 'MAD' });
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const load = async () => {
        try {
            const data = await api.pricingLists.list({ search: search || undefined, status: statusFilter || undefined });
            setLists(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [search, statusFilter]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const created = await api.pricingLists.create(createForm);
            toast.success('Grille tarifaire créée');
            setIsCreateOpen(false);
            setCreateForm({ code: '', name: '', description: '', currency_code: 'MAD' });
            navigate(`/settings/pricing/${created.id}`);
        } catch (e: any) { toast.error(e.message || 'Erreur'); }
    };

    const handleAction = async (action: string, pl: any) => {
        setOpenMenuId(null);
        try {
            if (action === 'open') { navigate(`/settings/pricing/${pl.id}`); return; }
            if (action === 'duplicate') { const d = await api.pricingLists.duplicate(pl.id); toast.success('Grille dupliquée'); navigate(`/settings/pricing/${d.id}`); }
            if (action === 'publish') { await api.pricingLists.publish(pl.id); toast.success('Grille publiée'); load(); }
            if (action === 'archive') { await api.pricingLists.archive(pl.id); toast.success('Grille archivée'); load(); }
        } catch (e: any) { toast.error(e.message || 'Erreur'); }
    };

    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '-';

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Grilles Tarifaires</h1>
                    <p className="text-slate-500">Gestion des grilles de prix et des actes associés</p>
                </div>
                <button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
                    <Plus size={20} /><span>Nouvelle Grille</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par code ou nom..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Tous les statuts</option>
                    <option value="DRAFT">Brouillon</option>
                    <option value="PUBLISHED">Publiée</option>
                    <option value="ARCHIVED">Archivée</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-500">Chargement...</div>
            ) : lists.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <DollarSign className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Aucune grille tarifaire trouvée.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3 font-semibold text-slate-700">Code</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Nom</th>
                                <th className="px-5 py-3 font-semibold text-slate-700 text-center">Version</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Statut</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Devise</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Validité</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Publiée le</th>
                                <th className="px-5 py-3 font-semibold text-slate-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {lists.map(pl => {
                                const st = STATUS_LABELS[pl.status] || STATUS_LABELS.DRAFT;
                                return (
                                    <tr key={pl.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/settings/pricing/${pl.id}`)}>
                                        <td className="px-5 py-3"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono font-bold">{pl.code}</span></td>
                                        <td className="px-5 py-3 font-medium text-slate-800">{pl.name}</td>
                                        <td className="px-5 py-3 text-center"><span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full text-xs font-bold">v{pl.version_no}</span></td>
                                        <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${st.color}`}>{st.label}</span></td>
                                        <td className="px-5 py-3 text-slate-500">{pl.currency_code}</td>
                                        <td className="px-5 py-3 text-slate-500 text-xs">{fmtDate(pl.valid_from)} — {fmtDate(pl.valid_to)}</td>
                                        <td className="px-5 py-3 text-slate-500 text-xs">{fmtDate(pl.published_at)}</td>
                                        <td className="px-5 py-3 text-right relative" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => setOpenMenuId(openMenuId === pl.id ? null : pl.id)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                                <MoreHorizontal size={18} />
                                            </button>
                                            {openMenuId === pl.id && (
                                                <div className="absolute right-4 top-12 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 w-48">
                                                    <button onClick={() => handleAction('open', pl)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"><DollarSign size={14} /> Ouvrir</button>
                                                    <button onClick={() => handleAction('duplicate', pl)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"><Copy size={14} /> Dupliquer</button>
                                                    {pl.status === 'DRAFT' && <button onClick={() => handleAction('publish', pl)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-emerald-600 flex items-center gap-2"><Send size={14} /> Publier</button>}
                                                    {pl.status !== 'ARCHIVED' && <button onClick={() => handleAction('archive', pl)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-500 flex items-center gap-2"><Archive size={14} /> Archiver</button>}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsCreateOpen(false)}>
                    <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">Nouvelle Grille Tarifaire</h2>
                            <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Code <span className="text-red-500">*</span></label>
                                <input type="text" required value={createForm.code} onChange={e => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" placeholder="ex: CONV_CNSS" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nom <span className="text-red-500">*</span></label>
                                <input type="text" required value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Convention CNSS 2026" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" rows={2} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Devise</label>
                                <select value={createForm.currency_code} onChange={e => setCreateForm({ ...createForm, currency_code: e.target.value })}
                                    className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="MAD">MAD - Dirham Marocain</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="USD">USD - Dollar US</option>
                                </select>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"><Save size={18} className="mr-2" /> Créer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
