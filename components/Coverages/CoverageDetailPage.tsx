import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ArrowLeft, ShieldCheck, Users as UsersIcon, Plus, X, Loader2, Pencil, Trash2, Save, UserCheck, UserPlus, Search, User, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const RELATIONSHIP_LABELS: Record<string, string> = {
    SELF: 'Titulaire',
    SPOUSE: 'Conjoint(e)',
    CHILD: 'Enfant',
    PARENT: 'Parent',
    OTHER: 'Autre',
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
    ACTIVE:     { label: 'Active',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    REPLACED:   { label: 'Remplacée',  color: 'bg-slate-100 text-slate-500 border-slate-200' },
    TERMINATED: { label: 'Terminée',   color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export const CoverageDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [coverage, setCoverage] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [organismes, setOrganismes] = useState<any[]>([]);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<any>({});

    const [memberModalOpen, setMemberModalOpen] = useState(false);
    const [memberEditing, setMemberEditing] = useState<any | null>(null);
    const [memberSaving, setMemberSaving] = useState(false);
    const [memberForm, setMemberForm] = useState<any>({
        relationshipToSubscriberCode: 'SELF',
        memberFirstName: '',
        memberLastName: '',
        memberIdentityType: 'CIN',
        memberIdentityValue: '',
        memberIssuingCountry: 'MA',
        tenantPatientId: '',
        tenantPatientLabel: ''
    });

    // Patient search inside the member modal
    const [patientQuery, setPatientQuery] = useState('');
    const [patientResults, setPatientResults] = useState<any[]>([]);
    const [patientSearching, setPatientSearching] = useState(false);

    useEffect(() => {
        if (!memberModalOpen) return;
        if (patientQuery.trim().length < 2) { setPatientResults([]); return; }
        const t = setTimeout(async () => {
            setPatientSearching(true);
            try {
                const res = await api.searchUniversal(patientQuery);
                setPatientResults(res as any[]);
            } catch (e) {
                console.error(e);
            } finally { setPatientSearching(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [patientQuery, memberModalOpen]);

    const pickPatient = (p: any) => {
        // When a patient is picked, we bind by tenant_patient_id and let the backend rely on
        // patients_tenant as source of truth — denormalized fields stay empty (server-side).
        // We still populate the inputs for visual confirmation and lock them.
        const primaryId = (p.identifiers && p.identifiers[0]) || null;
        setMemberForm((prev: any) => ({
            ...prev,
            tenantPatientId: p.id,
            tenantPatientLabel: `${p.lastName || ''} ${p.firstName || ''}`.trim(),
            memberFirstName: p.firstName || '',
            memberLastName: p.lastName || '',
            memberIdentityType: primaryId?.typeCode || prev.memberIdentityType || 'CIN',
            memberIdentityValue: primaryId?.value || '',
            memberIssuingCountry: primaryId?.issuingCountry || prev.memberIssuingCountry || 'MA'
        }));
        setPatientQuery('');
        setPatientResults([]);
    };

    const clearPickedPatient = () => {
        setMemberForm((prev: any) => ({
            ...prev,
            tenantPatientId: '',
            tenantPatientLabel: '',
            memberFirstName: '',
            memberLastName: '',
            memberIdentityType: 'CIN',
            memberIdentityValue: '',
            memberIssuingCountry: 'MA'
        }));
    };

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const data = await api.coverages.get(id);
            setCoverage(data);
            setForm({
                organismeId: data.organisme_id,
                policyNumber: data.policy_number || '',
                groupNumber: data.group_number || '',
                planName: data.plan_name || '',
                coverageTypeCode: data.coverage_type_code || '',
                effectiveFrom: data.effective_from ? String(data.effective_from).substring(0, 10) : '',
                effectiveTo: data.effective_to ? String(data.effective_to).substring(0, 10) : '',
                status: data.status || 'ACTIVE'
            });
        } catch (e: any) {
            toast.error(e.message || 'Erreur de chargement');
        } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        (async () => {
            try { setOrganismes(await api.getTenantOrganismes()); } catch {}
        })();
    }, []);

    const handleSaveCoverage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        setSaving(true);
        try {
            await api.coverages.update(id, {
                ...form,
                effectiveFrom: form.effectiveFrom || null,
                effectiveTo: form.effectiveTo || null
            });
            toast.success('Couverture mise à jour');
            setEditing(false);
            load();
        } catch (e: any) {
            toast.error(e.message || 'Erreur de mise à jour');
        } finally { setSaving(false); }
    };

    const openAddMember = () => {
        setMemberEditing(null);
        setMemberForm({
            relationshipToSubscriberCode: coverage?.members?.some((m: any) => m.relationship_to_subscriber_code === 'SELF') ? 'SPOUSE' : 'SELF',
            memberFirstName: '',
            memberLastName: '',
            memberIdentityType: 'CIN',
            memberIdentityValue: '',
            memberIssuingCountry: 'MA',
            tenantPatientId: '',
            tenantPatientLabel: ''
        });
        setPatientQuery('');
        setPatientResults([]);
        setMemberModalOpen(true);
    };

    const openEditMember = (m: any) => {
        setMemberEditing(m);
        const label = m.tenant_patient_id
            ? `${m.linked_patient_last_name || m.member_last_name || ''} ${m.linked_patient_first_name || m.member_first_name || ''}`.trim()
            : '';
        setMemberForm({
            relationshipToSubscriberCode: m.relationship_to_subscriber_code || 'SELF',
            memberFirstName: m.linked_patient_first_name || m.member_first_name || '',
            memberLastName: m.linked_patient_last_name || m.member_last_name || '',
            memberIdentityType: m.member_identity_type || 'CIN',
            memberIdentityValue: m.member_identity_value || '',
            memberIssuingCountry: m.member_issuing_country || 'MA',
            tenantPatientId: m.tenant_patient_id || '',
            tenantPatientLabel: label
        });
        setPatientQuery('');
        setPatientResults([]);
        setMemberModalOpen(true);
    };

    const handleSaveMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const linked = !!memberForm.tenantPatientId;
        // When a patient is linked, the patients_tenant record is the source of truth;
        // we keep denormalized fields NULL to avoid divergence. When unlinked (external),
        // we require the name fields.
        if (!linked) {
            if (!memberForm.memberFirstName?.trim() || !memberForm.memberLastName?.trim()) {
                toast.error('Prénom et nom requis pour un membre externe');
                return;
            }
        }
        setMemberSaving(true);
        try {
            const payload = {
                relationshipToSubscriberCode: memberForm.relationshipToSubscriberCode,
                tenantPatientId: memberForm.tenantPatientId || null,
                memberFirstName: linked ? null : memberForm.memberFirstName || null,
                memberLastName:  linked ? null : memberForm.memberLastName  || null,
                memberIdentityType:    linked ? null : (memberForm.memberIdentityValue ? memberForm.memberIdentityType : null),
                memberIdentityValue:   linked ? null : memberForm.memberIdentityValue   || null,
                memberIssuingCountry:  linked ? null : (memberForm.memberIdentityValue ? memberForm.memberIssuingCountry : null),
            };
            if (memberEditing) {
                await api.coverages.updateMember(memberEditing.coverage_member_id, payload);
                toast.success('Membre mis à jour');
            } else {
                await api.coverages.addMember(id, payload);
                toast.success('Membre ajouté');
            }
            setMemberModalOpen(false);
            load();
        } catch (e: any) {
            toast.error(e.message || 'Erreur');
        } finally { setMemberSaving(false); }
    };

    const handleRemoveMember = async (m: any) => {
        if (!confirm(`Retirer ${m.member_first_name || ''} ${m.member_last_name || ''} de cette couverture ?`)) return;
        try {
            await api.coverages.removeMember(m.coverage_member_id);
            toast.success('Membre retiré');
            load();
        } catch (e: any) {
            toast.error(e.message || 'Erreur');
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Chargement...
            </div>
        );
    }

    if (!coverage) {
        return (
            <div className="p-8">
                <button onClick={() => navigate('/coverages')} className="flex items-center text-slate-500 hover:text-slate-900 mb-4">
                    <ArrowLeft size={18} className="mr-1" /> Retour
                </button>
                <div className="text-center py-20 text-slate-400">Couverture introuvable</div>
            </div>
        );
    }

    const badge = STATUS_BADGE[coverage.status] || { label: coverage.status, color: 'bg-slate-100 text-slate-500 border-slate-200' };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <button onClick={() => navigate('/coverages')} className="flex items-center text-slate-500 hover:text-slate-900 mb-4 text-sm">
                <ArrowLeft size={16} className="mr-1" /> Retour aux couvertures
            </button>

            {/* Header card */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800">{coverage.organisme_designation || 'Organisme inconnu'}</h1>
                            <p className="font-mono text-sm text-slate-500">Police {coverage.policy_number || '—'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${badge.color}`}>
                            {badge.label}
                        </span>
                        {!editing && (
                            <button
                                onClick={() => setEditing(true)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold"
                            >
                                <Pencil size={14} /> Modifier
                            </button>
                        )}
                    </div>
                </div>

                {!editing && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <Field label="Organisme" value={coverage.organisme_designation || '—'} />
                        <Field label="Catégorie" value={coverage.organisme_category || '—'} />
                        <Field label="N° de police" value={coverage.policy_number || '—'} mono />
                        <Field label="N° de groupe" value={coverage.group_number || '—'} mono />
                        <Field label="Plan" value={coverage.plan_name || '—'} />
                        <Field label="Type" value={coverage.coverage_type_code || '—'} />
                        <Field label="Valide du" value={coverage.effective_from ? new Date(coverage.effective_from).toLocaleDateString('fr-FR') : '—'} />
                        <Field label="Valide au" value={coverage.effective_to ? new Date(coverage.effective_to).toLocaleDateString('fr-FR') : '—'} />
                    </div>
                )}

                {editing && (
                    <form onSubmit={handleSaveCoverage} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="col-span-2 md:col-span-3">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Organisme</label>
                            <select
                                value={form.organismeId}
                                onChange={e => setForm({ ...form, organismeId: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {organismes.map((o: any) => (
                                    <option key={o.id} value={o.id}>{o.designation}</option>
                                ))}
                            </select>
                        </div>
                        <InputField label="N° de police" value={form.policyNumber} onChange={v => setForm({ ...form, policyNumber: v })} />
                        <InputField label="N° de groupe" value={form.groupNumber} onChange={v => setForm({ ...form, groupNumber: v })} />
                        <InputField label="Plan" value={form.planName} onChange={v => setForm({ ...form, planName: v })} />
                        <InputField label="Type" value={form.coverageTypeCode} onChange={v => setForm({ ...form, coverageTypeCode: v })} />
                        <InputField label="Valide du" type="date" value={form.effectiveFrom} onChange={v => setForm({ ...form, effectiveFrom: v })} />
                        <InputField label="Valide au" type="date" value={form.effectiveTo} onChange={v => setForm({ ...form, effectiveTo: v })} />
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Statut</label>
                            <select
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="REPLACED">Remplacée</option>
                                <option value="TERMINATED">Terminée</option>
                            </select>
                        </div>
                        <div className="col-span-full flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => { setEditing(false); load(); }}
                                disabled={saving}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl disabled:opacity-50"
                            >Annuler</button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Members */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <UsersIcon size={18} className="text-indigo-600" /> Membres ({coverage.members?.length || 0})
                    </h2>
                    <button
                        onClick={openAddMember}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-bold"
                    >
                        <Plus size={14} /> Ajouter un membre
                    </button>
                </div>

                {(!coverage.members || coverage.members.length === 0) && (
                    <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        Aucun membre enregistré. Ajoutez au moins le titulaire.
                    </div>
                )}

                {coverage.members && coverage.members.length > 0 && (
                    <div className="overflow-hidden border border-slate-100 rounded-xl">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <tr>
                                    <th className="text-left px-4 py-3">Lien</th>
                                    <th className="text-left px-4 py-3">Nom</th>
                                    <th className="text-left px-4 py-3">Identité</th>
                                    <th className="text-left px-4 py-3">Patient lié</th>
                                    <th className="text-right px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {coverage.members.map((m: any) => (
                                    <tr key={m.coverage_member_id}>
                                        <td className="px-4 py-3">
                                            {m.relationship_to_subscriber_code === 'SELF' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    <UserCheck size={10} /> Titulaire
                                                </span>
                                            ) : (
                                                <span className="text-slate-600">{RELATIONSHIP_LABELS[m.relationship_to_subscriber_code] || m.relationship_to_subscriber_code}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            {m.linked_patient_last_name || m.member_last_name || '—'} {m.linked_patient_first_name || m.member_first_name || ''}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                            {m.member_identity_type && m.member_identity_value
                                                ? `${m.member_identity_type} · ${m.member_identity_value}`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {m.tenant_patient_id ? (
                                                <button
                                                    onClick={() => navigate(`/patient/${m.tenant_patient_id}`)}
                                                    className="text-indigo-600 hover:underline"
                                                >
                                                    Ouvrir le dossier
                                                </button>
                                            ) : (
                                                <span className="text-slate-400 italic">Non patient</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => openEditMember(m)}
                                                className="text-slate-400 hover:text-indigo-600 p-1 rounded transition-colors"
                                                title="Modifier"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRemoveMember(m)}
                                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                                title="Retirer"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Member modal */}
            {memberModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => !memberSaving && setMemberModalOpen(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                {memberEditing ? <><Pencil size={16} /> Modifier le membre</> : <><UserPlus size={16} /> Ajouter un membre</>}
                            </h3>
                            <button onClick={() => setMemberModalOpen(false)} disabled={memberSaving} className="text-slate-400 hover:text-slate-600">
                                <X size={22} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveMember} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Lien avec le titulaire</label>
                                <select
                                    value={memberForm.relationshipToSubscriberCode}
                                    onChange={e => setMemberForm({ ...memberForm, relationshipToSubscriberCode: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    disabled={memberSaving}
                                >
                                    <option value="SELF">Titulaire (SELF)</option>
                                    <option value="SPOUSE">Conjoint(e)</option>
                                    <option value="CHILD">Enfant</option>
                                    <option value="PARENT">Parent</option>
                                    <option value="OTHER">Autre</option>
                                </select>
                            </div>

                            {/* Patient search — binds an existing patient, otherwise leave blank for external */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-1 flex items-center gap-2">
                                    Patient lié
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[9px] font-black tracking-wider normal-case">RECHERCHE</span>
                                </label>

                                {memberForm.tenantPatientId ? (
                                    <div className="flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                                        <div className="flex items-center gap-2 text-indigo-800">
                                            <CheckCircle2 size={16} />
                                            <span className="font-bold">{memberForm.tenantPatientLabel || 'Patient lié'}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={clearPickedPatient}
                                            disabled={memberSaving}
                                            className="text-indigo-600 hover:text-indigo-900 text-[10px] font-black uppercase tracking-wider"
                                        >
                                            Détacher
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={patientQuery}
                                            onChange={e => setPatientQuery(e.target.value)}
                                            placeholder="Rechercher par nom, prénom, CIN..."
                                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            disabled={memberSaving}
                                        />
                                        {patientSearching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
                                        {patientResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-xl z-20 max-h-64 overflow-y-auto">
                                                {patientResults.map((p: any) => (
                                                    <button
                                                        type="button"
                                                        key={p.id}
                                                        onClick={() => pickPatient(p)}
                                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex items-center gap-2 border-b border-slate-50 last:border-0 transition-colors"
                                                    >
                                                        <User size={14} className="text-slate-400 shrink-0" />
                                                        <span className="font-bold text-slate-800">{p.lastName} {p.firstName}</span>
                                                        {p.ipp && <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{p.ipp}</span>}
                                                        {p.identifiers?.[0]?.value && (
                                                            <span className="ml-auto text-[10px] font-mono text-slate-400">{p.identifiers[0].typeCode} · {p.identifiers[0].value}</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {patientQuery.length >= 2 && !patientSearching && patientResults.length === 0 && (
                                            <div className="mt-1 text-[10px] text-slate-400 italic">
                                                Aucun patient trouvé — laissez vide pour créer un membre externe (non patient).
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Identity fields — locked when a patient is bound, editable otherwise */}
                            <div className={`rounded-xl p-3 border ${memberForm.tenantPatientId ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'}`}>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                    {memberForm.tenantPatientId
                                        ? 'Identité (lue depuis le dossier patient)'
                                        : 'Identité du membre externe'}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <InputField
                                        label="Prénom"
                                        value={memberForm.memberFirstName}
                                        onChange={(v: string) => setMemberForm({ ...memberForm, memberFirstName: v })}
                                        disabled={memberSaving || !!memberForm.tenantPatientId}
                                    />
                                    <InputField
                                        label="Nom"
                                        value={memberForm.memberLastName}
                                        onChange={(v: string) => setMemberForm({ ...memberForm, memberLastName: v })}
                                        disabled={memberSaving || !!memberForm.tenantPatientId}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-3 mt-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Doc.</label>
                                        <select
                                            value={memberForm.memberIdentityType}
                                            onChange={e => setMemberForm({ ...memberForm, memberIdentityType: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                                            disabled={memberSaving || !!memberForm.tenantPatientId}
                                        >
                                            <option value="CIN">CIN</option>
                                            <option value="PASSPORT">Passeport</option>
                                            <option value="RESIDENCE">Résidence</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <InputField
                                            label="N° de document"
                                            value={memberForm.memberIdentityValue}
                                            onChange={(v: string) => setMemberForm({ ...memberForm, memberIdentityValue: v })}
                                            disabled={memberSaving || !!memberForm.tenantPatientId}
                                        />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <InputField
                                        label="Pays émetteur"
                                        value={memberForm.memberIssuingCountry}
                                        onChange={(v: string) => setMemberForm({ ...memberForm, memberIssuingCountry: v })}
                                        disabled={memberSaving || !!memberForm.tenantPatientId}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setMemberModalOpen(false)}
                                    disabled={memberSaving}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl disabled:opacity-50"
                                >Annuler</button>
                                <button
                                    type="submit"
                                    disabled={memberSaving}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                                >
                                    {memberSaving && <Loader2 size={14} className="animate-spin" />} {memberEditing ? 'Enregistrer' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const Field: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
    <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</div>
        <div className={`text-slate-700 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
);

const InputField: React.FC<{ label: string; value: string; onChange?: (v: string) => void; type?: string; disabled?: boolean }> = ({ label, value, onChange, type = 'text', disabled = false }) => (
    <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">{label}</label>
        <input
            type={type}
            value={value}
            onChange={e => onChange && onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
        />
    </div>
);
