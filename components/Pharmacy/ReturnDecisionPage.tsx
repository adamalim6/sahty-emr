import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { 
    FileText, ArrowLeft, CheckCircle, AlertTriangle, Loader, 
    Trash2, Heart, DollarSign, Package, History 
} from 'lucide-react';

interface DecisionInput {
    qtyCommercial: number;
    qtyWaste: number;
    qtyCharity: number;
    commercialLocId: string; // Required if qtyCommercial > 0
    charityLocId: string;    // Required if qtyCharity > 0
}

interface ReceptionLine {
    id: string; // reception_line_id
    return_line_id: string;
    product_id: string;
    lot: string;
    expiry: string;
    qty_received_units: number;
    qty_declared_units: number;
    product_name?: string; 
    dci?: string;
}

export const ReturnDecisionPage: React.FC = () => {
    const { id: receptionId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    // Data States
    const [reception, setReception] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [priorDecisions, setPriorDecisions] = useState<Map<string, number>>(new Map()); // return_line_id -> total_decided
    const [locations, setLocations] = useState<any[]>([]);
    
    // UI States
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Form State
    const [inputs, setInputs] = useState<Record<string, DecisionInput>>({});

    useEffect(() => {
        loadData();
    }, [receptionId]);

    const loadData = async () => {
        if (!receptionId) return;
        setLoading(true);
        try {
            const [recepData, histData, locsData, catalogData] = await Promise.all([
                api.getReceptionDetails(receptionId),
                api.getReceptionsDecisions(receptionId),
                api.getLocations(),
                api.getCatalog({ status: 'ACTIVE' }) // Fetch active items
            ]);

            setReception(recepData);
            setHistory(histData);
            setLocations(locsData);

            // Calculate Prior Decisions Map
            const map = new Map<string, number>();
            histData.forEach((h: any) => {
                const current = map.get(h.return_line_id) || 0;
                map.set(h.return_line_id, current + h.qty_units);
            });
            setPriorDecisions(map);

            // Initialize Inputs
            const initialInputs: Record<string, DecisionInput> = {};
            const productList = catalogData.data || catalogData; // Handle pagination wrapper if exists
            
            recepData.lines.forEach((line: any) => {
                 // Try to resolve name from catalog locally if backend didn't
                const product = Array.isArray(productList) ? productList.find((p: any) => p.id === line.product_id) : null;
                if (product) {
                    line.product_name = product.name;
                    line.dci = product.dci;
                }
                
                initialInputs[line.return_line_id] = {
                    qtyCommercial: 0,
                    qtyWaste: 0,
                    qtyCharity: 0,
                    commercialLocId: '',
                    charityLocId: ''
                };
            });
            setInputs(initialInputs);

        } catch (err: any) {
            console.error(err);
            setError("Impossible de charger les données.");
        } finally {
            setLoading(false);
        }
    };

    // Filtered Location Lists - use camelCase to match API response
    const commercialLocs = locations.filter(l => 
        l.type === 'PHYSICAL' && l.scope === 'PHARMACY' && 
        (l.status === 'ACTIVE' || l.isActive) && 
        l.locationClass === 'COMMERCIAL' && l.valuationPolicy === 'VALUABLE'
    );

    const charityLocs = locations.filter(l => 
        l.type === 'PHYSICAL' && l.scope === 'PHARMACY' && 
        (l.status === 'ACTIVE' || l.isActive) && 
        l.locationClass === 'CHARITY'
    );

    const handleInputChange = (lineId: string, field: keyof DecisionInput, value: any) => {
        setInputs(prev => ({
            ...prev,
            [lineId]: {
                ...prev[lineId],
                [field]: value
            }
        }));
    };

    const validateSubmission = () => {
        // Check at least one decision > 0
        const hasAnyDecision = Object.values(inputs).some(i => 
            i.qtyCommercial > 0 || i.qtyWaste > 0 || i.qtyCharity > 0
        );
        if (!hasAnyDecision) return "Aucune décision saisie.";

        // Validate each line
        for (const line of reception.lines) {
            const defaultInput: DecisionInput = { qtyCommercial: 0, qtyWaste: 0, qtyCharity: 0, commercialLocId: '', charityLocId: '' };
            const input = inputs[line.return_line_id] || defaultInput;
            
            const totalDecidedNow = (input.qtyCommercial || 0) + (input.qtyWaste || 0) + (input.qtyCharity || 0);
            const prior = priorDecisions.get(line.return_line_id) || 0;
            const remaining = line.qty_received_units - prior;

            if (totalDecidedNow > remaining) {
                return `La quantité décidée pour ${line.product_name || 'Inconnu'} (${totalDecidedNow}) dépasse le reste à traiter (${remaining}).`;
            }

            if (input.qtyCommercial > 0 && !input.commercialLocId) return "Emplacement commercial requis.";
            if (input.qtyCharity > 0 && !input.charityLocId) return "Emplacement caritatif requis.";
            if (totalDecidedNow < 0) return "Quantités négatives interdites.";
        }
        return null;
    };

    const handleSubmit = async () => {
        const err = validateSubmission();
        if (err) { setError(err); return; }
        
        setError(null);
        setSuccessMsg(null);
        setSubmitting(true);

        try {
            const decisionsPayload = reception.lines.flatMap((line: any) => {
                const defaultInput: DecisionInput = { qtyCommercial: 0, qtyWaste: 0, qtyCharity: 0, commercialLocId: '', charityLocId: '' };
                const input = inputs[line.return_line_id] || defaultInput;
                const lineDecisions = [];
                
                if (input.qtyCommercial > 0) {
                    lineDecisions.push({
                        returnLineId: line.return_line_id,
                        qty: input.qtyCommercial,
                        outcome: 'COMMERCIAL',
                        destinationLocationId: input.commercialLocId
                    });
                }
                 if (input.qtyCharity > 0) {
                    lineDecisions.push({
                        returnLineId: line.return_line_id,
                        qty: input.qtyCharity,
                        outcome: 'CHARITY',
                        destinationLocationId: input.charityLocId
                    });
                }
                 if (input.qtyWaste > 0) {
                    lineDecisions.push({
                        returnLineId: line.return_line_id,
                        qty: input.qtyWaste,
                        outcome: 'WASTE'
                    });
                }
                return lineDecisions;
            });

            await api.createReturnDecision(receptionId!, decisionsPayload as any);
            setSuccessMsg("Décisions validées avec succès !");
            
            // Reload data after delay
            setTimeout(() => {
                loadData();
                setActiveTab('history'); // Switch to history to show results
                setSuccessMsg(null);
            }, 1000);

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Erreur lors de la validation.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader className="animate-spin" /></div>;
    if (!reception) return <div className="p-8">Réception introuvable.</div>;

    const isClosed = reception.status === 'CLOSED';

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        Décision Retour 
                        <span className="text-gray-500 text-lg font-normal">{reception.reception_reference}</span>
                    </h1>
                    <div className="text-sm text-gray-500 mt-1 flex gap-4">
                        <span>Reçu le: {new Date(reception.received_at).toLocaleString()}</span>
                        <span>Service: {reception.service_name || 'Inconnu'}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            reception.status === 'CLOSED' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                            {reception.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Error / Success */}
            {error && <div className="bg-red-50 text-red-600 p-4 rounded flex items-center gap-2"><AlertTriangle size={20}/>{error}</div>}
            {successMsg && <div className="bg-green-50 text-green-600 p-4 rounded flex items-center gap-2"><CheckCircle size={20}/>{successMsg}</div>}

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
                <button 
                    onClick={() => setActiveTab('new')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'new' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Nouvelle Décision
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Historique ({history.length})
                </button>
            </div>

            {/* New Decision Tab */}
            {activeTab === 'new' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {isClosed ? (
                        <div className="p-8 text-center text-gray-500">
                             <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                             <h3 className="text-lg font-medium">Réception Clôturée</h3>
                             <p>Toutes les décisions ont été prises pour cette réception.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {reception.lines.map((line: any) => {
                                const prior = priorDecisions.get(line.return_line_id) || 0;
                                const remaining = line.qty_received_units - prior;
                                
                                const defaultInput: DecisionInput = {
                                    qtyCommercial: 0, 
                                    qtyWaste: 0, 
                                    qtyCharity: 0, 
                                    commercialLocId: '', 
                                    charityLocId: ''
                                };
                                const input = inputs[line.return_line_id] || defaultInput;
                                
                                if (remaining <= 0) return null; // Skip fully decided lines

                                return (
                                    <div key={line.id} className="p-6 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{line.product_name || 'Produit Inconnu'}</h3>
                                                <div className="flex gap-2 text-xs text-gray-500 mt-1">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded border">Lot: {line.lot}</span>
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded border">Exp: {new Date(line.expiry).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-gray-600">Reçu: {line.qty_received_units}</div>
                                                <div className="text-sm font-bold text-blue-600">Reste à décider: {remaining}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Commercial */}
                                            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                                <div className="flex items-center gap-2 text-blue-800 font-medium mb-3">
                                                    <DollarSign size={18} /> Commercial
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Quantité</label>
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            max={remaining}
                                                            className="w-full border-gray-300 rounded-md text-sm"
                                                            value={input.qtyCommercial || ''}
                                                            onChange={(e) => handleInputChange(line.return_line_id, 'qtyCommercial', parseInt(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Destination</label>
                                                        <select 
                                                            className="w-full border-gray-300 rounded-md text-sm"
                                                            value={input.commercialLocId}
                                                            onChange={(e) => handleInputChange(line.return_line_id, 'commercialLocId', e.target.value)}
                                                            disabled={!input.qtyCommercial}
                                                        >
                                                            <option value="">Sélectionner...</option>
                                                            {commercialLocs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Waste */}
                                            <div className="bg-red-50/50 p-4 rounded-lg border border-red-100">
                                                <div className="flex items-center gap-2 text-red-800 font-medium mb-3">
                                                    <Trash2 size={18} /> Destruction
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Quantité</label>
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            max={remaining}
                                                            className="w-full border-gray-300 rounded-md text-sm"
                                                            value={input.qtyWaste || ''}
                                                            onChange={(e) => handleInputChange(line.return_line_id, 'qtyWaste', parseInt(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                    <div className="text-xs text-gray-400 italic pt-6">
                                                        Produit détruit, sortie définitive du stock valroisé.
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Charity */}
                                            <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                                                <div className="flex items-center gap-2 text-purple-800 font-medium mb-3">
                                                    <Heart size={18} /> Caritatif
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Quantité</label>
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            max={remaining}
                                                            className="w-full border-gray-300 rounded-md text-sm"
                                                            value={input.qtyCharity || ''}
                                                            onChange={(e) => handleInputChange(line.return_line_id, 'qtyCharity', parseInt(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Destination</label>
                                                        <select 
                                                            className="w-full border-gray-300 rounded-md text-sm"
                                                            value={input.charityLocId}
                                                            onChange={(e) => handleInputChange(line.return_line_id, 'charityLocId', e.target.value)}
                                                            disabled={!input.qtyCharity}
                                                        >
                                                            <option value="">Sélectionner...</option>
                                                            {charityLocs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    
                    {!isClosed && (
                        <div className="p-6 bg-gray-50 border-t flex justify-end">
                            <button 
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {submitting ? <Loader className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                Valider Décision
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {history.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Aucune décision enregistrée.</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-gray-500">Date</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Decidé par</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Produit</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Lot</th>
                                    <th className="px-6 py-3 font-medium text-gray-500 text-center">Quantité</th>
                                    <th className="px-6 py-3 font-medium text-gray-500">Décision</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map((h: any) => {
                                     // Resolve name from catalog if possible (loaded in state)
                                     // Actually catalogData isn't in state, but I can assume product name is missing or try to find it?
                                     // Better to store fetched catalog or map names.
                                     // Reception Lines has the names mapped!
                                     const line = reception.lines.find((l:any) => l.product_id === h.product_id);
                                     const productName = line?.product_name || 'Produit Inconnu';
                                     
                                     return (
                                        <tr key={h.id + h.return_line_id + h.outcome} className="hover:bg-gray-50">
                                            <td className="px-6 py-3 text-gray-600">{new Date(h.decided_at).toLocaleString()}</td>
                                            <td className="px-6 py-3 text-gray-600">{h.nom} {h.prenom}</td>
                                            <td className="px-6 py-3 font-medium text-gray-900">{productName}</td>
                                            <td className="px-6 py-3 text-gray-600">{h.lot}</td>
                                            <td className="px-6 py-3 text-center font-bold">{h.qty_units}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                    h.outcome === 'COMMERCIAL' ? 'bg-blue-100 text-blue-800' :
                                                    h.outcome === 'WASTE' ? 'bg-red-100 text-red-800' :
                                                    'bg-purple-100 text-purple-800'
                                                }`}>
                                                    {h.outcome}
                                                </span>
                                            </td>
                                        </tr>
                                     );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};
