
import React, { useState } from 'react';
import { X, AlertCircle, ArrowRight, Package, Check, ShieldAlert } from 'lucide-react';
import { Dispensation } from '../../types/serialized-pack';
import { api } from '../../services/api';

import { ProductDefinition } from '../../types/pharmacy';

interface ReturnCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    admissionId?: string;
    dispensation?: Dispensation;
    product?: ProductDefinition;
    onSuccess: () => void;
    serviceName?: string;
}

export const ReturnCreationModal: React.FC<ReturnCreationModalProps> = ({
    isOpen,
    onClose,
    admissionId,
    dispensation,
    product,
    onSuccess,
    serviceName
}) => {
    const [step, setStep] = useState(1);
    const [returnType, setReturnType] = useState<'SEALED' | 'OPENED'>('SEALED');
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New State for Service Return
    const [returnDestination, setReturnDestination] = useState<'CENTRAL_PHARMACY' | 'SERVICE_STOCK'>('CENTRAL_PHARMACY');
    const [targetLocationId, setTargetLocationId] = useState<string>('');
    const [serviceLocations, setServiceLocations] = useState<any[]>([]);

    const isServiceExit = dispensation?.prescriptionId === 'SERVICE_EXIT';

    // Validation Rule: Opened/Units can only go to Service Stock if Subdivisible
    const isServiceReturnAllowed = () => {
        if (!product) return true; // Safety
        if (!product.isSubdivisable) {
            // If not subdivisible...
            // If Box Mode and OPENED -> Block
            if (isBoxMode && returnType === 'OPENED') return false;
            // If Unit Mode (implicitly opened/loose) -> Block
            if (!isBoxMode) return false;
        }
        return true;
    };

    React.useEffect(() => {
        // Auto-switch back to Central if Service becomes invalid
        if (returnDestination === 'SERVICE_STOCK' && !isServiceReturnAllowed()) {
            setReturnDestination('CENTRAL_PHARMACY');
        }
    }, [returnType, quantity]); // Check when conditions change

    React.useEffect(() => {
        if (returnDestination === 'SERVICE_STOCK') {
            api.getEmrLocations().then(locs => {
                // Ideally filter by serviceName if possible, for now show all
                // Could filter: locs.filter(l => l.name.includes(serviceName || ''))
                setServiceLocations(locs);
                if (locs.length > 0) setTargetLocationId(locs[0].id);
            }).catch(console.error);
        }
    }, [returnDestination]);

    if (!isOpen || !dispensation) return null;

    // Fix mode check with explicit cast (Handle all variations)
    const isBoxMode = (dispensation.mode as any) === 'FULL_PACK' || dispensation.mode === 'Boîte Complète' || dispensation.mode === 'BOX';
    const maxQty = dispensation.quantity;

    // Resolve Product Name safely
    const productName = product?.name || dispensation.productName || 'Médicament Inconnu';
    
    // Safety Date
    const expiryDateDisplay = dispensation.expiryDate && !isNaN(new Date(dispensation.expiryDate).getTime())
        ? new Date(dispensation.expiryDate).toLocaleDateString()
        : 'Date Invalide';

    const handleSubmit = async () => {
        if (!admissionId) return;

        try {
            setLoading(true);
            setError(null);

            // Construct return item
            const item = {
                productId: dispensation.productId,
                quantity: quantity,
                condition: isBoxMode ? returnType : 'OPENED', // Units are always considered "Opened/Loose" structure-wise
                sourceType: 'PHARMACY', // Assuming admission returns go back to pharmacy flows usually
                // If the dispensation was from Service Stock, we might want to return to Service Stock?
                // But the requirement says "Admission > Pharmacy Return".
                // Let's assume standard return for now.
                serialNumber: isBoxMode ? dispensation.serialNumber : undefined,
                batchNumber: dispensation.lotNumber,
                expiryDate: dispensation.expiryDate,
                dispensationId: dispensation.id, // Link to original dispensation
                parentContainerId: undefined // Would need to be selected if we had valid parent linkage in frontend
            };

            await api.createReturnRequest({
                admissionId,
                items: [item],
                destination: returnDestination,
                userId: 'CURRENT_USER', // Should get from context
                targetLocationId: returnDestination === 'SERVICE_STOCK' ? targetLocationId : undefined,
                serviceId: returnDestination === 'SERVICE_STOCK' ? serviceName : undefined
            });

            onSuccess();
            onClose();
        } catch (err) {
            setError('Erreur lors de la création de la demande');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const unitsPerPack = product?.unitsPerPack || 1;
    const isOpened = returnType === 'OPENED';

    // If Box Mode:
    // - Sealed: Max is number of boxes (usually 1 due to serialization)
    // - Opened: Max is unitsPerPack (returning the remaining units of that 1 box)
    // If Unit Mode:
    // - Always units, Max is dispensation quantity
    const currentMax = isBoxMode && isOpened
        ? unitsPerPack
        : maxQty;

    const quantityLabel = isBoxMode && !isOpened ? 'Boîte(s)' : 'Unité(s)';

    // Reset quantity when switching modes to avoid invalid states
    React.useEffect(() => {
        if (isBoxMode && isOpened) {
            setQuantity(unitsPerPack); // Default to full (or should it be 1?) - let's default to max/full
        } else {
            setQuantity(1);
        }
    }, [returnType, isBoxMode, unitsPerPack]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center">
                        <ShieldAlert size={18} className="mr-2 text-indigo-600" />
                        Retourner un produit
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start">
                        <Package className="text-blue-500 mt-1 mr-3 flex-shrink-0" size={20} />
                        <div>
                            <div className="font-bold text-blue-900 text-sm">{productName}</div>
                            <div className="text-xs text-blue-700 mt-1">Lot: {dispensation.lotNumber} • Exp: {expiryDateDisplay}</div>
                            {isBoxMode && isOpened && (
                                <div className="text-xs text-amber-600 font-bold mt-1">
                                    Retour partiel (Unités restantes sur {unitsPerPack})
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">

                        {/* Destination Selector for Service Exits */}
                        {isServiceExit && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Destination du retour</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setReturnDestination('CENTRAL_PHARMACY')}
                                        className={`p-2 rounded-lg text-xs font-bold transition-all ${returnDestination === 'CENTRAL_PHARMACY'
                                            ? 'bg-white shadow text-indigo-600 ring-2 ring-indigo-100'
                                            : 'text-slate-500 hover:bg-white hover:shadow-sm'
                                            }`}
                                    >
                                        Pharmacie Centrale
                                    </button>
                                    <button
                                        onClick={() => setReturnDestination('SERVICE_STOCK')}
                                        disabled={!isServiceReturnAllowed()}
                                        className={`p-2 rounded-lg text-xs font-bold transition-all ${returnDestination === 'SERVICE_STOCK'
                                            ? 'bg-white shadow text-indigo-600 ring-2 ring-indigo-100'
                                            : !isServiceReturnAllowed()
                                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                                : 'text-slate-500 hover:bg-white hover:shadow-sm'
                                            }`}
                                    >
                                        Stock Service {!isServiceReturnAllowed() && '(Incompatible)'}
                                    </button>
                                </div>

                                {returnDestination === 'SERVICE_STOCK' && (
                                    <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Emplacement cible</label>
                                        <select
                                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                            value={targetLocationId}
                                            onChange={(e) => setTargetLocationId(e.target.value)}
                                        >
                                            {serviceLocations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                        {isBoxMode && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">État du produit</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setReturnType('SEALED')}
                                        className={`p-3 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${returnType === 'SEALED'
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                            }`}
                                    >
                                        <Check size={20} className={`mb-1 ${returnType === 'SEALED' ? 'opacity-100' : 'opacity-0'}`} />
                                        Intact / Scellé
                                    </button>

                                    <button
                                        onClick={() => setReturnType('OPENED')}
                                        className={`p-3 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${returnType === 'OPENED'
                                            ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                            }`}
                                    >
                                        <AlertCircle size={20} className={`mb-1 ${returnType === 'OPENED' ? 'opacity-100' : 'opacity-0'}`} />
                                        Entamé / Ouvert
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Quantité à retourner</label>
                            <div className="flex items-center">
                                <input
                                    type="number"
                                    min="1"
                                    max={currentMax}
                                    value={quantity}
                                    onChange={(e) => setQuantity(Math.min(currentMax, Math.max(1, parseInt(e.target.value) || 1)))}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-center text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="ml-3 text-sm font-bold text-slate-500 uppercase w-20">
                                    {quantityLabel}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 text-center">
                                Max disponible: {currentMax} {quantityLabel}
                            </p>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-center animate-in fade-in slide-in-from-top-2">
                                <AlertCircle size={16} className="mr-2" />
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center"
                    >
                        {loading ? 'Traitement...' : 'Confirmer le retour'}
                        {!loading && <ArrowRight size={18} className="ml-2" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
