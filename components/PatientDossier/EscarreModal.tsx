import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { X, Save, Clock, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

interface EscarreModalProps {
    patientId: string;
    escarreId: string | null;
    pendingCoords: { x: number, y: number, z: number } | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const EscarreModal: React.FC<EscarreModalProps> = ({ patientId, escarreId, pendingCoords, onClose, onSuccess }) => {
    const isNew = !escarreId;
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    
    const [history, setHistory] = useState<any[]>([]);
    const [baseEscarre, setBaseEscarre] = useState<any>(null);

    const [form, setForm] = useState({
        stage: 1,
        lengthMm: '',
        widthMm: '',
        depthMm: '',
        exudateAmount: 'none',
        tissueType: '',
        odor: 'none',
        painScale: 0,
        infectionSigns: false,
        dressing: '',
        notes: ''
    });

    useEffect(() => {
        if (!isNew && escarreId) {
            loadEscarreDetails(escarreId);
        }
    }, [escarreId]);

    const loadEscarreDetails = async (id: string) => {
        try {
            setFetching(true);
            const data = await api.getEscarreDetails(id);
            setBaseEscarre(data);
            setHistory(data.history || []);
            
            if (data.latestSnapshot) {
                setForm({
                    stage: data.latestSnapshot.stage,
                    lengthMm: data.latestSnapshot.lengthMm || '',
                    widthMm: data.latestSnapshot.widthMm || '',
                    depthMm: data.latestSnapshot.depthMm || '',
                    exudateAmount: data.latestSnapshot.exudateAmount || 'none',
                    tissueType: data.latestSnapshot.tissueType || '',
                    odor: data.latestSnapshot.odor || 'none',
                    painScale: data.latestSnapshot.painScale || 0,
                    infectionSigns: data.latestSnapshot.infectionSigns || false,
                    dressing: data.latestSnapshot.dressing || '',
                    notes: data.latestSnapshot.notes || ''
                });
            }
        } catch (e) {
            console.error("Failed to load details", e);
        } finally {
            setFetching(false);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const snapshotPayload = {
                stage: Number(form.stage),
                lengthMm: form.lengthMm ? Number(form.lengthMm) : undefined,
                widthMm: form.widthMm ? Number(form.widthMm) : undefined,
                depthMm: form.depthMm ? Number(form.depthMm) : undefined,
                exudateAmount: form.exudateAmount,
                tissueType: form.tissueType,
                odor: form.odor,
                painScale: Number(form.painScale),
                infectionSigns: form.infectionSigns,
                dressing: form.dressing,
                notes: form.notes
            };

            if (isNew && pendingCoords) {
                await api.createEscarre({
                    tenantPatientId: patientId,
                    posX: pendingCoords.x,
                    posY: pendingCoords.y,
                    posZ: pendingCoords.z,
                    snapshot: snapshotPayload
                });
            } else if (escarreId) {
                await api.addEscarreSnapshot(escarreId, snapshotPayload);
            }
            
            onSuccess();
        } catch (e) {
            console.error("Error saving escarre", e);
            alert("Erreur lors de la sauvegarde. Veuillez vérifier les champs.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = async () => {
        if (!escarreId) return;
        if (!window.confirm("Êtes-vous sûr de vouloir déclarer cette escarre comme résolue ?")) return;
        
        try {
            setLoading(true);
            await api.deactivateEscarre(escarreId);
            onSuccess();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                {isNew ? 'Déclarer une nouvelle lésion' : 'Suivi de la lésion'}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                {isNew ? 'Coord. capturées sur le modèle 3D' : `ID: ${escarreId?.split('-')[0].toUpperCase()}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {fetching ? (
                    <div className="flex-1 flex justify-center items-center py-20">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        
                        {/* Left Side: Form */}
                        <div className="w-full md:w-3/5 p-6 overflow-y-auto border-r border-slate-100 shrink-0">
                            <div className="space-y-6">
                                
                                {/* Stage Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3">Stade de l'escarre <span className="text-red-500">*</span></label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {[1, 2, 3, 4].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setForm({ ...form, stage: s })}
                                                className={`py-3 rounded-xl border-2 font-bold transition-all ${
                                                    form.stage === s 
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                                                }`}
                                            >
                                                Stade {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Dimensions */}
                                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Longueur (mm)</label>
                                        <input type="number" value={form.lengthMm} onChange={e => setForm({...form, lengthMm: e.target.value})} className="w-full p-2 border rounded-lg bg-white" placeholder="Ex: 40" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Largeur (mm)</label>
                                        <input type="number" value={form.widthMm} onChange={e => setForm({...form, widthMm: e.target.value})} className="w-full p-2 border rounded-lg bg-white" placeholder="Ex: 30" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Profondeur (mm)</label>
                                        <input type="number" value={form.depthMm} onChange={e => setForm({...form, depthMm: e.target.value})} className="w-full p-2 border rounded-lg bg-white" placeholder="Ex: 10" />
                                    </div>
                                </div>

                                {/* Clinical State */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Exsudat</label>
                                        <select value={form.exudateAmount} onChange={e => setForm({...form, exudateAmount: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg">
                                            <option value="none">Aucun</option>
                                            <option value="low">Faible</option>
                                            <option value="moderate">Modéré</option>
                                            <option value="heavy">Abondant</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Odeur</label>
                                        <select value={form.odor} onChange={e => setForm({...form, odor: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg">
                                            <option value="none">Aucune</option>
                                            <option value="mild">Légère</option>
                                            <option value="strong">Forte</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Range Slider Pain */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-slate-700">Évaluation de la douleur (EVA)</label>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                            form.painScale < 4 ? 'bg-green-100 text-green-700' :
                                            form.painScale < 7 ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>{form.painScale} / 10</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="10" 
                                        value={form.painScale} 
                                        onChange={e => setForm({...form, painScale: Number(e.target.value)})} 
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1 mt-1">
                                        <span>Indolore</span>
                                        <span>Modérée</span>
                                        <span>Insupportable</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Plaque / Pansement Actuel</label>
                                    <input type="text" value={form.dressing} onChange={e => setForm({...form, dressing: e.target.value})} className="w-full p-2.5 border border-slate-200 rounded-lg" placeholder="Hydrocolloïde, Alginate..." />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Observations (Optionnel)</label>
                                    <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-lg min-h-[100px]" placeholder="Précisez l'évolution, le type de tissu visible..."></textarea>
                                </div>
                                
                                <label className="flex items-center gap-3 p-4 border border-rose-200 bg-rose-50 rounded-xl cursor-pointer hover:bg-rose-100 transition-colors">
                                    <input type="checkbox" checked={form.infectionSigns} onChange={e => setForm({...form, infectionSigns: e.target.checked})} className="w-5 h-5 rounded border-rose-300 text-rose-500 focus:ring-rose-500" />
                                    <div>
                                        <span className="block font-bold text-rose-800">Signes cliniques d'infection locale</span>
                                        <span className="text-xs text-rose-600">Érythème périlésionnel, chaleur, suppuration, majoration des douleurs.</span>
                                    </div>
                                </label>

                            </div>
                        </div>

                        {/* Right Side: Timeline History (Visible only on Updates) */}
                        {!isNew && (
                            <div className="w-2/5 border-l border-slate-100 bg-slate-50 flex flex-col">
                                <div className="p-4 border-b border-slate-200 bg-slate-100 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-slate-500" />
                                    <h3 className="font-bold text-slate-700">Historique des Évaluations</h3>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto bg-white">
                                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-4">
                                        {history.map((snap, i) => (
                                            <div key={snap.id} className="relative pl-6">
                                                <div className="absolute w-4 h-4 rounded-full bg-blue-500 border-4 border-white -left-[9px] top-1 shadow-sm" />
                                                <div className="text-sm font-bold text-slate-800">Stade {snap.stage}</div>
                                                <div className="text-xs text-slate-500 mb-2">{new Date(snap.recordedAt).toLocaleString('fr-FR')}</div>
                                                
                                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 grid gap-1">
                                                    {(snap.lengthMm || snap.widthMm) && (
                                                        <div className="font-medium">Dim: {snap.lengthMm || '?'} x {snap.widthMm || '?'} {snap.depthMm ? `x ${snap.depthMm}` : ''} mm</div>
                                                    )}
                                                    {snap.infectionSigns && (
                                                        <div className="text-rose-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Infection Suspectée</div>
                                                    )}
                                                    {snap.notes && <div className="mt-1 italic border-l-2 border-slate-200 pl-2">"{snap.notes}"</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between mt-auto">
                    <div className="w-1/3 text-left">
                        {!isNew && baseEscarre?.isActive && (
                            <button onClick={handleDeactivate} disabled={loading} className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-sm flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4"/> Déclarer comme Résolue
                            </button>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 flex-1">
                        <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors text-sm">
                            Annuler
                        </button>
                        <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 transition-all">
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                            {isNew ? 'Enregistrer la lésion' : 'Ajouter au dossier'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
