import React, { useCallback, useEffect, useState } from 'react';
import { Plus, List, Loader2, ShieldCheck, ShieldAlert, ShieldQuestion, Lock, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { AdmissionChargeEvent } from '../../types';
import { AddActModal } from './AddActModal';

interface ActesProps {
    admissionId?: string;
}

const formatAmount = (n: string | number | null | undefined, currency: string = 'MAD') => {
    if (n == null) return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return `${num.toFixed(2)} ${currency}`;
};

const PricingStatusBadge: React.FC<{ event: AdmissionChargeEvent }> = ({ event }) => {
    if (event.status === 'VOIDED_BEFORE_POSTING') {
        return <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-slate-100 text-slate-500">Annulé</span>;
    }
    if (event.pricing_status === 'RESOLVED') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck size={10} /> Tarifé
            </span>
        );
    }
    if (event.pricing_status === 'PROVISIONAL') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-amber-50 text-amber-700 border border-amber-200"
                title="Aucun tarif trouvé — à réviser">
                <ShieldAlert size={10} /> Provisoire
            </span>
        );
    }
    if (event.pricing_status === 'PENDING_REVIEW') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-rose-50 text-rose-700 border border-rose-200"
                title="Aucune configuration tarifaire — à configurer">
                <ShieldQuestion size={10} /> À réviser
            </span>
        );
    }
    return null;
};

const CoverageBadge: React.FC<{ event: AdmissionChargeEvent }> = ({ event }) => {
    if (event.coverage_resolution_mode === 'FALLBACK_DEFAULT') {
        return (
            <span className="ml-2 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-slate-100 text-slate-600">
                Grille par défaut
            </span>
        );
    }
    return null;
};

export const Actes: React.FC<ActesProps> = ({ admissionId }) => {
    const [charges, setCharges] = useState<AdmissionChargeEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [voidTarget, setVoidTarget] = useState<AdmissionChargeEvent | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [voiding, setVoiding] = useState(false);

    const load = useCallback(async () => {
        if (!admissionId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await api.admissionCharges.list(admissionId);
            setCharges(data as AdmissionChargeEvent[]);
        } catch (e: any) {
            setError(e.message || 'Chargement échoué');
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => { load(); }, [load]);

    const handleAdded = (_result: any) => { load(); };

    const handleVoid = async () => {
        if (!voidTarget) return;
        setVoiding(true);
        try {
            await api.admissionCharges.void(voidTarget.id, voidReason || undefined);
            setVoidTarget(null);
            setVoidReason('');
            await load();
        } catch (e: any) {
            setError(e.message || 'Annulation échouée');
        } finally {
            setVoiding(false);
        }
    };

    if (!admissionId) {
        return (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
                <div className="text-center py-20 text-slate-400">Admission introuvable</div>
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black uppercase text-slate-800 flex items-center">
                    <List className="mr-3 text-indigo-600" /> Liste des Actes
                </h3>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold flex items-center shadow-lg hover:bg-emerald-700 transition-all"
                >
                    <Plus size={18} className="mr-2" /> Ajouter un acte
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {loading && (
                <div className="text-center py-16 text-slate-400 flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Chargement...
                </div>
            )}

            {!loading && charges.length === 0 && (
                <div className="text-center py-20 text-slate-300">
                    <List size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold">Aucun acte médical ou chirurgical saisi pour cette admission.</p>
                </div>
            )}

            {!loading && charges.length > 0 && (
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <tr>
                                <th className="text-left px-4 py-3">Code</th>
                                <th className="text-left px-4 py-3">Libellé</th>
                                <th className="text-left px-4 py-3">Qté</th>
                                <th className="text-right px-4 py-3">Prix unit.</th>
                                <th className="text-right px-4 py-3">Total</th>
                                <th className="text-left px-4 py-3">Statut</th>
                                <th className="text-right px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {charges.map(c => {
                                const snap = c.current_snapshot;
                                const voided = c.status === 'VOIDED_BEFORE_POSTING';
                                return (
                                    <tr key={c.id} className={voided ? 'opacity-60' : ''}>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.global_act_code_sih || '—'}</td>
                                        <td className="px-4 py-3 text-slate-700 font-medium">
                                            {snap?.billing_label || c.global_act_libelle_sih || '—'}
                                            {snap?.pricing_list_code && (
                                                <span className="ml-2 text-[10px] font-mono text-slate-400">
                                                    {snap.pricing_list_code} v{snap.pricing_list_version_no ?? '?'}
                                                    {snap.pricing_list_item_version_no != null && `.${snap.pricing_list_item_version_no}`}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{Number(c.quantity).toString()}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                                            {snap ? formatAmount(snap.unit_price_snapshot, snap.currency_code) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                                            {snap ? formatAmount(snap.total_price_snapshot, snap.currency_code) : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center flex-wrap gap-1">
                                                <PricingStatusBadge event={c} />
                                                <CoverageBadge event={c} />
                                                {c.pricing_lock_status === 'MANUAL_LOCK' && (
                                                    <span className="ml-1 text-slate-400" title="Verrouillé manuellement">
                                                        <Lock size={12} />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {!voided && (
                                                <button
                                                    onClick={() => { setVoidTarget(c); setVoidReason(''); }}
                                                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                                    title="Annuler cet acte"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showAddModal && (
                <AddActModal
                    admissionId={admissionId}
                    onClose={() => setShowAddModal(false)}
                    onAdded={handleAdded}
                />
            )}

            {voidTarget && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => !voiding && setVoidTarget(null)}>
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-slate-800">Annuler l'acte</h3>
                            <button onClick={() => setVoidTarget(null)} disabled={voiding} className="text-slate-400 hover:text-slate-600">
                                <X size={22} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                            Annuler <strong>{voidTarget.global_act_libelle_sih}</strong> ? L'historique de tarification sera conservé.
                        </p>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Motif (optionnel)</label>
                        <input
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500 mb-4"
                            value={voidReason}
                            onChange={e => setVoidReason(e.target.value)}
                            disabled={voiding}
                        />
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setVoidTarget(null)}
                                disabled={voiding}
                                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl disabled:opacity-50"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleVoid}
                                disabled={voiding}
                                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {voiding && <Loader2 size={14} className="animate-spin" />} Confirmer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
