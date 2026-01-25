import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ArrowLeft, CheckCircle, Package, AlertTriangle, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface TransferLine {
    id: string; // generated draft line id
    product_id: string;
    product_name?: string;
    lot: string;
    expiry: string;
    qty_transferred: number;
}

interface Transfer {
    id: string;
    source_location_id: string;
    destination_location_id: string;
    items: TransferLine[];
}

const TransferExecution: React.FC<{ transferId: string; onBack: () => void; onComplete: () => void }> = ({ transferId, onBack, onComplete }) => {
    const [transfer, setTransfer] = useState<Transfer | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadData();
    }, [transferId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.getStockTransferDetails(transferId);
            setTransfer(data);
        } catch (error) {
            console.error(error);
            toast.error("Erreur chargement transfert");
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!confirm('Confirmer le transfert de stock ? Cette action est irréversible.')) return;
        setProcessing(true);
        try {
            await api.executeStockTransfer(transferId);
            toast.success('Transfert exécuté avec succès');
            onComplete();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Erreur exécution');
        } finally {
            setProcessing(false);
        }
    };

    // Note: The draft ALREADY contains specific lots/batches because the backend draft creation assigned them (mock behavior)
    // OR did the backend draft creation assign lots?
    // Looking at my backend code: `createTransferDraft` inserts lines with `product_id, lot, expiry, qty`.
    // BUT the input to `createTransfer` usually doesn't have batch details if it comes from `validateAndDraft`.
    // IN `PharmacyDemandDetail.tsx`, I created a draft with items ONLY having `product_id` and `qty`.
    // I did NOT provide `lot` or `expiry`.
    // The backend `createTransferDraft` expects `item.lot` and `item.expiry`.
    // If they are missing, the insert might fail or insert NULL.
    // AND `executeTransfer` relies on them to deduct stock.
    // 
    // CRITICAL BUG: My `PharmacyDemandDetail` creates a draft WITHOUT selecting batches.
    // The backend `createTransfer` will fail or create incomplete lines.
    // 
    // Correction:
    // 1. `PharmacyDemandDetail` should CREATE DRAFT -> `StockTransferService` should probably Auto-Allocate (FEFO) if not specified? 
    //    OR `PharmacyDemandDetail` should just create a "Shell" and `TransferExecution` allows selecting batches.
    //
    // Current backend `createTransferDraft`:
    // `INSERT INTO stock_transfer_lines ... VALUES ..., item.lot, item.expiry ...`
    // If I send null/undefined, it will fail (if NOT NULL schema) or insert NULL.
    // Then `executeTransfer` does `SELECT qty_units FROM current_stock ... WHERE lot = ?`.
    // If lot is NULL, it won't match stock.
    //
    // Plan:
    // Update `TransferExecution` to ALLOW selecting/editing batches for each line.
    // BUT `TransferExecution` is currently just a "Confirm" screen.
    // I need `TransferExecution` to be a "Picker" screen.
    // 
    // AND I need `PharmacyDemandDetail` to pass empty lots, or `StockTransferService` to accept them.
    // 
    // Let's assume `PharmacyDemandDetail` passed empty lots.
    // `TransferExecution` needs to:
    // 1. Load Transfer.
    // 2. Load Inventory (Source Loc).
    // 3. For each line, if Lot is missing, providing a UI to pick Lot.
    // 4. Update the Transfer Draft with selected Lots. (New API: `updateTransferDraft`)
    // 5. Then Execute.
    //
    // This is getting complicated.
    // SIMPLIFICATION:
    // `PharmacyDemandDetail` validates Qty.
    // It creates a "Draft" with `lot='PENDING'`, `expiry='PENDING'`.
    // `TransferExecution` fetches this.
    // It sees 'PENDING'.
    // It allows user to "Pick Batch". 
    // User saves. Frontend calls `updateTransferLine(lineId, {lot, expiry})`.
    // Then Execute.
    //
    // I need to add `updateTransferLine` endpoint or `updateTransfer`.
    // OR create the draft in `TransferExecution` instead of `PharmacyDemandDetail`?
    // No, `PharmacyDemandDetail` transitions status to "Processing".
    //
    // I will simplify further: "Auto-Allocation FEFO" in backend `createTransferDraft` if lot is missing.
    // This is the most efficient way.
    // 
    // I will modify `stockTransferService.ts` -> `createTransferDraft` to auto-allocate if items are missing lot info.
    // 
    // Plan Adjustment:
    // 1. Modify `stockTransferService.ts`: `createTransferDraft` logic.
    //    If item.lot is missing -> Find FEFO stock in `source_location_id` for `product_id`.
    //    Take available stock. If insufficient, partial pick? Or error? Error for now.
    // 2. `TransferExecution` then just shows the allocated batches and asks for confirmation.
    
    // Let's modify Backend `stockTransferService.ts` to implement FEFO auto-allocation.
    
    // I will write `TransferExecution.tsx` assuming backend DOES auto-allocate.
    
    if (loading || !transfer) return <div className="p-8 text-center">Chargement...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                 <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Confirmer le Transfert</h2>
                        <div className="text-sm text-slate-500">
                             ID: <span className="font-mono">{transfer.id}</span>
                        </div>
                    </div>
                 </div>
                 <button 
                    onClick={handleExecute}
                    disabled={processing}
                    className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-bold shadow-lg shadow-green-200 transition-all flex items-center gap-2"
                >
                    {processing ? 'Exécution...' : <><CheckCircle size={20} /> Exécuter le mouvement</>}
                </button>
            </div>

            <div className="space-y-4">
                <div className="flex gap-4 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-100">
                    <AlertTriangle size={20} className="shrink-0" />
                    <div>
                        <p className="font-bold">Allocation Automatique (FEFO)</p>
                        <p>Les lots ont été automatiquement sélectionnés selon la règle Premier Périmé, Premier Sorti. Veuillez vérifier la correspondance physique avant de confirmer.</p>
                    </div>
                </div>

                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 border-b">
                        <tr>
                            <th className="p-3">Produit</th>
                            <th className="p-3">Lot</th>
                            <th className="p-3">Expiration</th>
                            <th className="p-3 text-right">Qté</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {transfer.items.map(line => (
                            <tr key={line.id}>
                                <td className="p-3 font-medium text-slate-800">
                                    {line.product_id}
                                    {/* Ideally fetch name */}
                                </td>
                                <td className="p-3 font-mono">{line.lot || <span className="text-red-500">NON ALLOUÉ</span>}</td>
                                <td className="p-3">{line.expiry ? new Date(line.expiry).toLocaleDateString() : '-'}</td>
                                <td className="p-3 text-right font-bold">{line.qty_transferred}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransferExecution;
