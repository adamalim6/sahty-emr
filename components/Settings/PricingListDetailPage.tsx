import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Edit2, Send, Archive, Copy, Plus, X, Save,
    ChevronDown, ChevronRight, Search, Trash2, RotateCcw,
    DollarSign, Building2, FileText
} from 'lucide-react';

const STATUS = {
    DRAFT: { label: 'Brouillon', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    PUBLISHED: { label: 'Publiée', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    ARCHIVED: { label: 'Archivée', color: 'bg-slate-100 text-slate-500 border-slate-200' },
} as Record<string, { label: string; color: string }>;

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '-';
const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
const fmtPrice = (v: number | string | null) => v != null ? parseFloat(String(v)).toFixed(2) : '-';

const DISPATCH_TYPES = [
    { key: 'PART_MEDECIN_1', label: 'Part Médecin 1' },
    { key: 'PART_MEDECIN_2', label: 'Part Médecin 2' },
    { key: 'PART_CLINIQUE_BLOC', label: 'Part Clinique / Bloc' },
    { key: 'PART_PHARMACIE', label: 'Part Pharmacie' },
    { key: 'PART_LABO', label: 'Part Labo' },
    { key: 'PART_RADIOLOGIE', label: 'Part Radiologie' },
    { key: 'PART_SEJOUR', label: 'Part Séjour' },
];

// ============================================================
// MAIN COMPONENT
// ============================================================
export const PricingListDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [pl, setPl] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'items' | 'organismes'>('items');

    // Items state
    const [items, setItems] = useState<any[]>([]);
    const [showRemoved, setShowRemoved] = useState(false);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [itemVersions, setItemVersions] = useState<any[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);

    // Organismes state
    const [organismes, setOrganismes] = useState<any[]>([]);

    // Modals
    const [headerEditOpen, setHeaderEditOpen] = useState(false);
    const [headerForm, setHeaderForm] = useState<any>({});
    const [addItemOpen, setAddItemOpen] = useState(false);
    const [addItemSearch, setAddItemSearch] = useState('');
    const [addItemResults, setAddItemResults] = useState<any[]>([]);
    const [versionEditorOpen, setVersionEditorOpen] = useState(false);
    const [versionEditorMode, setVersionEditorMode] = useState<'create' | 'edit'>('create');
    const [versionForm, setVersionForm] = useState<any>({ unit_price: '', billing_label: '', valid_from: '', valid_to: '', change_reason: '', change_type: '', dispatches: [] });
    const [versionEditorItemId, setVersionEditorItemId] = useState<string>('');
    const [versionEditorVersionId, setVersionEditorVersionId] = useState<string>('');
    const [versionEditorActName, setVersionEditorActName] = useState<string>('');
    const [assignOrgOpen, setAssignOrgOpen] = useState(false);
    const [availableOrgs, setAvailableOrgs] = useState<any[]>([]);

    const isDraft = pl?.status === 'DRAFT';

    const loadPl = useCallback(async () => {
        if (!id) return;
        try {
            const data = await api.pricingLists.get(id);
            setPl(data);
        } catch (e) { toast.error('Erreur de chargement'); }
        finally { setLoading(false); }
    }, [id]);

    const loadItems = useCallback(async () => {
        if (!id) return;
        const data = await api.pricingLists.listItems(id, showRemoved);
        setItems(data);
    }, [id, showRemoved]);

    const loadOrganismes = useCallback(async () => {
        if (!id) return;
        const data = await api.pricingLists.listOrganismes(id);
        setOrganismes(data);
    }, [id]);

    useEffect(() => { loadPl(); }, [loadPl]);
    useEffect(() => { if (id) loadItems(); }, [loadItems]);
    useEffect(() => { if (id && activeTab === 'organismes') loadOrganismes(); }, [activeTab, loadOrganismes]);

    const refreshVersionsFor = async (itemId: string) => {
        setExpandedItemId(itemId);
        setLoadingVersions(true);
        try {
            const data = await api.pricingLists.getItemVersions(id!, itemId);
            setItemVersions(data);
        } catch (e) { toast.error('Erreur'); }
        finally { setLoadingVersions(false); }
    };

    const loadVersionsFor = async (itemId: string) => {
        if (expandedItemId === itemId) { setExpandedItemId(null); return; }
        refreshVersionsFor(itemId);
    };

    // --- HEADER ACTIONS ---
    const openHeaderEdit = () => {
        setHeaderForm({ code: pl.code, name: pl.name, description: pl.description || '', currency_code: pl.currency_code, valid_from: pl.valid_from || '', valid_to: pl.valid_to || '', change_reason: pl.change_reason || '' });
        setHeaderEditOpen(true);
    };
    const saveHeader = async (e: React.FormEvent) => {
        e.preventDefault();
        try { const updated = await api.pricingLists.update(id!, headerForm); setPl(updated); setHeaderEditOpen(false); toast.success('Grille mise à jour'); }
        catch (e: any) { toast.error(e.message); }
    };
    const publishPl = async () => {
        if (!window.confirm('Publier cette grille tarifaire ?')) return;
        try { const updated = await api.pricingLists.publish(id!); setPl(updated); toast.success('Grille publiée'); }
        catch (e: any) { toast.error(e.message); }
    };
    const archivePl = async () => {
        if (!window.confirm('Archiver cette grille tarifaire ?')) return;
        try { const updated = await api.pricingLists.archive(id!); setPl(updated); toast.success('Grille archivée'); }
        catch (e: any) { toast.error(e.message); }
    };
    const duplicatePl = async () => {
        try { const d = await api.pricingLists.duplicate(id!); toast.success('Grille dupliquée'); navigate(`/settings/pricing/${d.id}`); }
        catch (e: any) { toast.error(e.message); }
    };

    // --- ITEM ACTIONS ---
    const searchActes = async (q: string) => {
        setAddItemSearch(q);
        if (q.length < 2) { setAddItemResults([]); return; }
        try { const data = await api.pricingLists.searchActes(q); setAddItemResults(data); } catch {}
    };
    const addItem = async (globalActId: string) => {
        try { await api.pricingLists.addItem(id!, globalActId); toast.success('Acte ajouté'); setAddItemOpen(false); setAddItemSearch(''); setAddItemResults([]); loadItems(); }
        catch (e: any) { toast.error(e.message); }
    };
    const removeItem = async (itemId: string) => {
        if (!window.confirm('Retirer cet acte de la grille ?')) return;
        try { await api.pricingLists.removeItem(id!, itemId); toast.success('Acte retiré'); loadItems(); }
        catch (e: any) { toast.error(e.message); }
    };
    const reactivateItem = async (itemId: string) => {
        try { await api.pricingLists.reactivateItem(id!, itemId); toast.success('Acte réactivé'); loadItems(); }
        catch (e: any) { toast.error(e.message); }
    };

    // --- VERSION ACTIONS ---
    const buildDispatchGrid = (existing?: any[]) => {
        return DISPATCH_TYPES.map((dt, idx) => {
            const found = existing?.find((d: any) => d.dispatch_type === dt.key);
            return { dispatch_type: dt.key, allocation_value: found?.allocation_value ?? '', sequence_no: found?.sequence_no ?? idx + 1 };
        });
    };

    const openVersionCreate = (itemId: string, actName?: string) => {
        setVersionEditorItemId(itemId);
        setVersionEditorActName(actName || '');
        setVersionEditorMode('create');
        setVersionForm({ unit_price: '', billing_label: '', valid_from: '', valid_to: '', change_reason: '', change_type: '', dispatches: buildDispatchGrid() });
        setVersionEditorOpen(true);
    };
    const openVersionEdit = (itemId: string, version: any, actName?: string) => {
        setVersionEditorItemId(itemId);
        setVersionEditorActName(actName || '');
        setVersionEditorVersionId(version.id);
        setVersionEditorMode('edit');
        setVersionForm({
            unit_price: version.unit_price, billing_label: version.billing_label || '',
            valid_from: version.valid_from || '', valid_to: version.valid_to || '',
            change_reason: version.change_reason || '', change_type: version.change_type || '',
            dispatches: buildDispatchGrid(version.dispatches)
        });
        setVersionEditorOpen(true);
    };
    const saveVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...versionForm, unit_price: parseFloat(versionForm.unit_price), dispatches: versionForm.dispatches.filter((d: any) => d.allocation_value !== '' && d.allocation_value != null) };
        try {
            if (versionEditorMode === 'create') { await api.pricingLists.createItemVersion(id!, versionEditorItemId, payload); toast.success('Version créée'); }
            else { await api.pricingLists.updateDraftVersion(versionEditorVersionId, payload); toast.success('Version mise à jour'); }
            setVersionEditorOpen(false);
            loadItems();
            refreshVersionsFor(versionEditorItemId);
        } catch (e: any) { toast.error(e.message); }
    };
    const publishVersion = async (versionId: string) => {
        if (!window.confirm('Publier cette version ? La version publiée précédente sera archivée.')) return;
        try { await api.pricingLists.publishItemVersion(versionId); toast.success('Version publiée'); loadItems(); if (expandedItemId) refreshVersionsFor(expandedItemId); }
        catch (e: any) { toast.error(e.message); }
    };

    // --- DISPATCH HELPERS ---
    const updateDispatchRow = (idx: number, field: string, value: any) => {
        const d = [...versionForm.dispatches]; d[idx] = { ...d[idx], [field]: value }; setVersionForm({ ...versionForm, dispatches: d });
    };

    // --- ORGANISME ACTIONS ---
    const openAssignOrg = async () => {
        try { const data = await api.pricingLists.listAvailableOrganismes(); setAvailableOrgs(data); setAssignOrgOpen(true); } catch {}
    };
    const assignOrg = async (orgId: string) => {
        try { await api.pricingLists.assignOrganisme(id!, { organisme_id: orgId }); toast.success('Organisme assigné'); setAssignOrgOpen(false); loadOrganismes(); }
        catch (e: any) { toast.error(e.message); }
    };
    const removeOrg = async (assignmentId: string) => {
        if (!window.confirm('Retirer cet organisme ?')) return;
        try { await api.pricingLists.removeOrganisme(assignmentId); toast.success('Organisme retiré'); loadOrganismes(); }
        catch (e: any) { toast.error(e.message); }
    };
    const reactivateOrg = async (assignmentId: string) => {
        try { await api.pricingLists.reactivateOrganisme(assignmentId); toast.success('Organisme réactivé'); loadOrganismes(); }
        catch (e: any) { toast.error(e.message); }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;
    if (!pl) return <div className="p-8 text-center text-red-500">Grille tarifaire introuvable</div>;

    const st = STATUS[pl.status] || STATUS.DRAFT;

    return (
        <div className="flex flex-col h-full">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/settings/pricing')} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><ArrowLeft size={20} /></button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-slate-800">{pl.name}</h1>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${st.color}`}>{st.label}</span>
                                <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full text-xs font-bold">v{pl.version_no}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                                <span className="font-mono font-bold">{pl.code}</span>
                                <span>{pl.currency_code}</span>
                                {pl.valid_from && <span>Du {fmtDate(pl.valid_from)}</span>}
                                {pl.valid_to && <span>Au {fmtDate(pl.valid_to)}</span>}
                                {pl.description && <span className="text-slate-400">— {pl.description}</span>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isDraft && <button onClick={openHeaderEdit} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1"><Edit2 size={14} /> Modifier</button>}
                        <button onClick={duplicatePl} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1"><Copy size={14} /> Dupliquer</button>
                        {isDraft && <button onClick={publishPl} className="px-3 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center gap-1"><Send size={14} /> Publier</button>}
                        {pl.status !== 'ARCHIVED' && <button onClick={archivePl} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg flex items-center gap-1"><Archive size={14} /> Archiver</button>}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex mt-4 border-b border-slate-200 -mb-5">
                    <button onClick={() => setActiveTab('items')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'items' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <FileText size={14} className="inline mr-1.5 -mt-0.5" />Actes
                    </button>
                    <button onClick={() => setActiveTab('organismes')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'organismes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        <Building2 size={14} className="inline mr-1.5 -mt-0.5" />Organismes
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-auto p-8">
                {activeTab === 'items' ? (
                    <ItemsTab
                        items={items} showRemoved={showRemoved} setShowRemoved={setShowRemoved}
                        expandedItemId={expandedItemId} itemVersions={itemVersions} loadingVersions={loadingVersions}
                        loadVersionsFor={loadVersionsFor} openVersionCreate={openVersionCreate} openVersionEdit={openVersionEdit}
                        removeItem={removeItem} reactivateItem={reactivateItem} publishVersion={publishVersion}
                        onAddItem={() => setAddItemOpen(true)} loadItems={loadItems}
                    />
                ) : (
                    <OrganismesTab
                        organismes={organismes} onAssign={openAssignOrg} onRemove={removeOrg} onReactivate={reactivateOrg}
                    />
                )}
            </div>

            {/* === MODALS === */}

            {/* Header Edit Modal */}
            {headerEditOpen && (
                <Modal title="Modifier la grille" onClose={() => setHeaderEditOpen(false)}>
                    <form onSubmit={saveHeader} className="space-y-3">
                        <Field label="Code" required><input className="input" value={headerForm.code} onChange={e => setHeaderForm({ ...headerForm, code: e.target.value.toUpperCase() })} required /></Field>
                        <Field label="Nom" required><input className="input" value={headerForm.name} onChange={e => setHeaderForm({ ...headerForm, name: e.target.value })} required /></Field>
                        <Field label="Description"><textarea className="input" rows={2} value={headerForm.description} onChange={e => setHeaderForm({ ...headerForm, description: e.target.value })} /></Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Du"><input type="date" className="input" value={headerForm.valid_from} onChange={e => setHeaderForm({ ...headerForm, valid_from: e.target.value })} /></Field>
                            <Field label="Au"><input type="date" className="input" value={headerForm.valid_to} onChange={e => setHeaderForm({ ...headerForm, valid_to: e.target.value })} /></Field>
                        </div>
                        <Field label="Motif de modification"><input className="input" value={headerForm.change_reason} onChange={e => setHeaderForm({ ...headerForm, change_reason: e.target.value })} /></Field>
                        <ModalFooter onCancel={() => setHeaderEditOpen(false)} />
                    </form>
                </Modal>
            )}

            {/* Add Item Modal */}
            {addItemOpen && (
                <Modal title="Ajouter un acte" onClose={() => { setAddItemOpen(false); setAddItemSearch(''); setAddItemResults([]); }}>
                    <div className="relative mb-4">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Rechercher un acte (code ou libellé)..."
                            value={addItemSearch} onChange={e => searchActes(e.target.value)} autoFocus />
                    </div>
                    <div className="max-h-64 overflow-y-auto border rounded-lg divide-y divide-slate-100">
                        {addItemResults.length === 0 && addItemSearch.length >= 2 && <div className="p-4 text-center text-sm text-slate-400">Aucun résultat</div>}
                        {addItemResults.map((a: any) => (
                            <button key={a.id} onClick={() => addItem(a.id)} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between text-sm transition-colors">
                                <div><span className="font-mono text-xs text-slate-500 mr-2">{a.code_sih}</span><span className="font-medium text-slate-700">{a.libelle_sih}</span></div>
                                <Plus size={16} className="text-blue-500 shrink-0" />
                            </button>
                        ))}
                    </div>
                </Modal>
            )}

            {/* Version Editor Drawer */}
            {versionEditorOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setVersionEditorOpen(false)}>
                    <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{versionEditorMode === 'create' ? 'Nouvelle version tarifaire' : 'Modifier le brouillon'}</h2>
                                {versionEditorActName && <p className="text-xs text-slate-500 mt-0.5">{versionEditorActName}</p>}
                            </div>
                            <button onClick={() => setVersionEditorOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
                        </div>
                        <form onSubmit={saveVersion} className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Prix unitaire" required>
                                    <input type="number" step="0.01" min="0" className="input" required value={versionForm.unit_price} onChange={e => setVersionForm({ ...versionForm, unit_price: e.target.value })} />
                                </Field>
                                <Field label="Libellé de facturation">
                                    <input className="input" value={versionForm.billing_label} onChange={e => setVersionForm({ ...versionForm, billing_label: e.target.value })} />
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Valide du"><input type="date" className="input" value={versionForm.valid_from} onChange={e => setVersionForm({ ...versionForm, valid_from: e.target.value })} /></Field>
                                <Field label="Valide au"><input type="date" className="input" value={versionForm.valid_to} onChange={e => setVersionForm({ ...versionForm, valid_to: e.target.value })} /></Field>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Motif du changement"><input className="input" value={versionForm.change_reason} onChange={e => setVersionForm({ ...versionForm, change_reason: e.target.value })} /></Field>
                                <Field label="Type de changement"><input className="input" placeholder="ex: Révision annuelle" value={versionForm.change_type} onChange={e => setVersionForm({ ...versionForm, change_type: e.target.value })} /></Field>
                            </div>

                            {/* Dispatch Grid — all types shown */}
                            <div className="border-t border-slate-100 pt-4">
                                <label className="text-sm font-semibold text-slate-700 mb-3 block">Ventilation</label>
                                <div className="space-y-2">
                                    {versionForm.dispatches.map((d: any, idx: number) => {
                                        const dt = DISPATCH_TYPES.find(t => t.key === d.dispatch_type);
                                        return (
                                            <div key={d.dispatch_type} className="flex items-center gap-3">
                                                <span className="text-xs font-medium text-slate-600 w-40 shrink-0">{dt?.label || d.dispatch_type}</span>
                                                <input type="number" step="0.01" min="0" placeholder="Montant"
                                                    className="flex-1 border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                    value={d.allocation_value} onChange={e => updateDispatchRow(idx, 'allocation_value', e.target.value)} />
                                                <span className="text-xs text-slate-400 w-10">MAD</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {versionForm.unit_price && (
                                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Total ventilé</span>
                                        <span className={`font-bold ${
                                            versionForm.dispatches.reduce((s: number, d: any) => s + (parseFloat(d.allocation_value) || 0), 0).toFixed(2) === parseFloat(versionForm.unit_price).toFixed(2)
                                            ? 'text-emerald-600' : 'text-amber-600'
                                        }`}>
                                            {versionForm.dispatches.reduce((s: number, d: any) => s + (parseFloat(d.allocation_value) || 0), 0).toFixed(2)} / {parseFloat(versionForm.unit_price).toFixed(2)} MAD
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setVersionEditorOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Annuler</button>
                                <button type="submit" className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 flex items-center text-sm"><Save size={16} className="mr-1.5" /> Brouillon</button>
                                <button type="button" onClick={async (e) => {
                                    e.preventDefault();
                                    const payload = { ...versionForm, unit_price: parseFloat(versionForm.unit_price), dispatches: versionForm.dispatches.filter((d: any) => d.allocation_value !== '' && d.allocation_value != null) };
                                    try {
                                        let vId = versionEditorVersionId;
                                        if (versionEditorMode === 'create') {
                                            const created = await api.pricingLists.createItemVersion(id!, versionEditorItemId, payload);
                                            vId = created.id;
                                        } else {
                                            await api.pricingLists.updateDraftVersion(versionEditorVersionId, payload);
                                        }
                                        await api.pricingLists.publishItemVersion(vId);
                                        toast.success('Version publiée');
                                        setVersionEditorOpen(false);
                                        loadItems();
                                        refreshVersionsFor(versionEditorItemId);
                                    } catch (err: any) { toast.error(err.message); }
                                }} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center text-sm">
                                    <Send size={16} className="mr-1.5" /> Publier
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Organisme Modal */}
            {assignOrgOpen && (
                <Modal title="Assigner un organisme" onClose={() => setAssignOrgOpen(false)}>
                    <div className="max-h-64 overflow-y-auto border rounded-lg divide-y divide-slate-100">
                        {availableOrgs.map((o: any) => (
                            <button key={o.id} onClick={() => assignOrg(o.id)} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between text-sm transition-colors">
                                <div><span className="font-medium text-slate-700">{o.designation}</span><span className="ml-2 text-xs text-slate-400">{o.category}</span></div>
                                <Plus size={16} className="text-blue-500 shrink-0" />
                            </button>
                        ))}
                        {availableOrgs.length === 0 && <div className="p-4 text-center text-sm text-slate-400">Aucun organisme disponible</div>}
                    </div>
                </Modal>
            )}
        </div>
    );
};

// ============================================================
// ITEMS TAB
// ============================================================
const ItemsTab: React.FC<any> = ({ items, showRemoved, setShowRemoved, expandedItemId, itemVersions, loadingVersions, loadVersionsFor, openVersionCreate, openVersionEdit, removeItem, reactivateItem, publishVersion, onAddItem }) => (
    <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <button onClick={onAddItem} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm"><Plus size={16} /> Ajouter un acte</button>
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                    <input type="checkbox" checked={showRemoved} onChange={e => setShowRemoved(e.target.checked)} className="rounded border-slate-300" />
                    Afficher les retirés
                </label>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{items.length} acte(s)</span>
        </div>

        {items.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <DollarSign className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <p className="text-slate-500 font-medium text-sm">Aucun acte dans cette grille.</p>
            </div>
        ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 w-8"></th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Code</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Libellé</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Statut</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 text-right">Prix actuel</th>
                            <th className="px-4 py-3 font-semibold text-slate-700">Validité</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map((item: any) => {
                            const isExpanded = expandedItemId === item.id;
                            const isRemoved = item.membership_status === 'REMOVED';
                            const hasDraft = item.latest_version_status === 'DRAFT';
                            return (
                                <React.Fragment key={item.id}>
                                    <tr className={`transition-colors cursor-pointer ${isRemoved ? 'opacity-50' : 'hover:bg-slate-50'}`} onClick={() => loadVersionsFor(item.id)}>
                                        <td className="px-4 py-3">{isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}</td>
                                        <td className="px-4 py-3"><span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{item.code_sih}</span></td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{item.libelle_sih}</td>
                                        <td className="px-4 py-3">
                                            {isRemoved ? <span className="text-xs text-red-500 font-semibold">Retiré</span> : <span className="text-xs text-emerald-600 font-semibold">Actif</span>}
                                            {hasDraft && <span className="ml-1.5 text-xs bg-amber-100 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">Brouillon</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">{item.latest_unit_price != null ? fmtPrice(item.latest_unit_price) : '-'}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(item.latest_valid_from)} — {fmtDate(item.latest_valid_to)}</td>
                                        <td className="px-4 py-3 text-right space-x-1" onClick={e => e.stopPropagation()}>
                                            {!isRemoved && <button onClick={() => openVersionCreate(item.id, item.libelle_sih)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Nouvelle version"><Plus size={16} /></button>}
                                            {!isRemoved && hasDraft && <button onClick={() => openVersionEdit(item.id, { id: item.id, ...item }, item.libelle_sih)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Modifier brouillon"><Edit2 size={16} /></button>}
                                            {!isRemoved ? <button onClick={() => removeItem(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Retirer"><Trash2 size={16} /></button>
                                                : <button onClick={() => reactivateItem(item.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Réactiver"><RotateCcw size={16} /></button>}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr><td colSpan={7} className="p-0">
                                            <VersionHistory versions={itemVersions} loading={loadingVersions} publishVersion={publishVersion}
                                                openVersionEdit={(v: any) => openVersionEdit(item.id, v, item.libelle_sih)} openVersionCreate={() => openVersionCreate(item.id, item.libelle_sih)} />
                                        </td></tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

// ============================================================
// VERSION HISTORY (expanded row)
// ============================================================
const VersionHistory: React.FC<{ versions: any[]; loading: boolean; publishVersion: (id: string) => void; openVersionEdit: (v: any) => void; openVersionCreate: () => void }> = ({ versions, loading, publishVersion, openVersionEdit, openVersionCreate }) => {
    if (loading) return <div className="p-4 text-center text-xs text-slate-400">Chargement des versions...</div>;
    if (versions.length === 0) return (
        <div className="p-4 bg-slate-50 text-center">
            <p className="text-xs text-slate-400 mb-2">Aucune version tarifaire.</p>
            <button onClick={openVersionCreate} className="text-xs text-blue-600 font-semibold hover:underline">Créer la première version</button>
        </div>
    );
    return (
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 space-y-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Historique des versions ({versions.length})</div>
            {versions.map((v: any) => {
                const st = STATUS[v.status] || STATUS.DRAFT;
                return (
                    <div key={v.id} className={`bg-white rounded-lg border p-4 ${v.status === 'DRAFT' ? 'border-amber-200' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-600">v{v.version_no}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}>{st.label}</span>
                                <span className="text-xs font-bold text-slate-800">{fmtPrice(v.unit_price)} MAD</span>
                                {v.billing_label && <span className="text-xs text-slate-500 italic">— {v.billing_label}</span>}
                            </div>
                            <div className="flex items-center gap-1">
                                {v.status === 'DRAFT' && <button onClick={() => openVersionEdit(v)} className="text-xs text-blue-600 hover:underline font-semibold">Modifier</button>}
                                {v.status === 'DRAFT' && <button onClick={() => publishVersion(v.id)} className="text-xs text-emerald-600 hover:underline font-semibold ml-2">Publier</button>}
                                {v.status === 'PUBLISHED' && <button onClick={openVersionCreate} className="text-xs text-blue-600 hover:underline font-semibold">Nouvelle version</button>}
                            </div>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-4 flex-wrap">
                            {v.valid_from && <span>Du {fmtDate(v.valid_from)}</span>}
                            {v.valid_to && <span>Au {fmtDate(v.valid_to)}</span>}
                            {v.change_reason && <span className="text-slate-400">Motif: {v.change_reason}</span>}
                            {v.change_type && <span className="text-slate-400">Type: {v.change_type}</span>}
                            <span className="text-slate-400">Créé le {fmtDateTime(v.created_at)}{v.created_by_name && ` par ${v.created_by_name}`}</span>
                            {v.published_at && <span className="text-slate-400">Publié le {fmtDateTime(v.published_at)}{v.published_by_name && ` par ${v.published_by_name}`}</span>}
                        </div>
                        {v.dispatches && v.dispatches.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Ventilation</div>
                                <div className="grid grid-cols-4 gap-1 text-[11px]">
                                    {v.dispatches.map((d: any) => {
                                        const dt = DISPATCH_TYPES.find(t => t.key === d.dispatch_type);
                                        return (
                                            <div key={d.id} className="bg-slate-50 rounded px-2 py-1 border border-slate-100">
                                                <span className="font-semibold text-slate-600">{dt?.label || d.dispatch_type}</span>
                                                <span className="ml-1 text-slate-400">{parseFloat(d.allocation_value).toFixed(2)} MAD</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ============================================================
// ORGANISMES TAB
// ============================================================
const OrganismesTab: React.FC<{ organismes: any[]; onAssign: () => void; onRemove: (id: string) => void; onReactivate: (id: string) => void }> = ({ organismes, onAssign, onRemove, onReactivate }) => (
    <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-4">
            <button onClick={onAssign} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm"><Plus size={16} /> Assigner un organisme</button>
            <span className="text-xs text-slate-400 font-semibold">{organismes.length} organisme(s)</span>
        </div>
        {organismes.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <Building2 className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <p className="text-slate-500 font-medium text-sm">Aucun organisme assigné.</p>
            </div>
        ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-5 py-3 font-semibold text-slate-700">Organisme</th>
                            <th className="px-5 py-3 font-semibold text-slate-700">Catégorie</th>
                            <th className="px-5 py-3 font-semibold text-slate-700">Statut</th>
                            <th className="px-5 py-3 font-semibold text-slate-700">Validité</th>
                            <th className="px-5 py-3 font-semibold text-slate-700">Assigné le</th>
                            <th className="px-5 py-3 font-semibold text-slate-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {organismes.map((o: any) => {
                            const isRemoved = o.assignment_status === 'REMOVED';
                            return (
                                <tr key={o.id} className={`transition-colors ${isRemoved ? 'opacity-50' : 'hover:bg-slate-50'}`}>
                                    <td className="px-5 py-3 font-medium text-slate-800">{o.organisme_designation}</td>
                                    <td className="px-5 py-3 text-slate-500 text-xs">{o.organisme_category}</td>
                                    <td className="px-5 py-3">{isRemoved ? <span className="text-xs text-red-500 font-semibold">Retiré</span> : <span className="text-xs text-emerald-600 font-semibold">Actif</span>}</td>
                                    <td className="px-5 py-3 text-xs text-slate-500">{fmtDate(o.valid_from)} — {fmtDate(o.valid_to)}</td>
                                    <td className="px-5 py-3 text-xs text-slate-500">{fmtDateTime(o.assigned_at)}</td>
                                    <td className="px-5 py-3 text-right">
                                        {!isRemoved ? <button onClick={() => onRemove(o.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                            : <button onClick={() => onReactivate(o.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><RotateCcw size={16} /></button>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

// ============================================================
// SHARED UI HELPERS
// ============================================================
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className={`bg-white rounded-xl ${wide ? 'max-w-2xl' : 'max-w-md'} w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
            </div>
            {children}
        </div>
    </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
        {React.Children.map(children, child => {
            if (React.isValidElement(child) && (child.type === 'input' || child.type === 'textarea' || child.type === 'select')) {
                return React.cloneElement(child as React.ReactElement<any>, {
                    className: 'w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                });
            }
            return child;
        })}
    </div>
);

const ModalFooter: React.FC<{ onCancel: () => void }> = ({ onCancel }) => (
    <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center text-sm"><Save size={16} className="mr-1.5" /> Enregistrer</button>
    </div>
);
