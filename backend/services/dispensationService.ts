
import { Dispensation, DispensationMode, SerializedPack, PackStatus } from '../models/serialized-pack';
import { ProductDefinition } from '../models/pharmacy';
import { serializedPackService } from './serializedPackService';
import { PharmacyService } from './pharmacyService';

interface DispenseParams {
    prescriptionId: string;
    admissionId: string;
    productId: string;
    mode: DispensationMode;
    quantity: number;
    userId: string;
    targetPackIds?: string[]; // Manual selection support
}

interface StockCheckResult {
    available: boolean;
    details: string;
    availableUnits?: number;
}

class DispensationService {
    private dispensations: Dispensation[] = [];

    /**
     * Vérifie la disponibilité du stock
     */
    checkAvailableStock(
        productId: string,
        mode: DispensationMode,
        quantity: number
    ): StockCheckResult {
        if (quantity <= 0) {
             return { available: false, details: "La quantité doit être positive." };
        }
        const statuses = (mode === DispensationMode.FULL_PACK || (mode as any) === 'FULL_PACK')
            ? [PackStatus.SEALED]
            : [PackStatus.OPENED, PackStatus.SEALED];

        const packs = serializedPackService.getPacks({
            productId,
            status: undefined
        }).filter(p => statuses.includes(p.status));

        if (mode === DispensationMode.FULL_PACK || (mode as any) === 'FULL_PACK') {
            const availablePacks = packs.filter(p =>
                p.status === PackStatus.SEALED &&
                p.remainingUnits === p.unitsPerPack
            ).length;

            if (availablePacks >= quantity) {
                return {
                    available: true,
                    details: `${availablePacks} boîtes disponibles`,
                    availableUnits: availablePacks
                };
            } else {
                return {
                    available: false,
                    details: `Seulement ${availablePacks} boîtes disponibles, ${quantity} demandées`
                };
            }
        } else {
            // Mode UNIT
            const totalAvailable = packs.reduce((sum, p) => sum + p.remainingUnits, 0);

            if (totalAvailable >= quantity) {
                return {
                    available: true,
                    details: `${totalAvailable} unités disponibles`,
                    availableUnits: totalAvailable
                };
            } else {
                return {
                    available: false,
                    details: `Seulement ${totalAvailable} unités disponibles, ${quantity} demandées`
                };
            }
        }
    }

    /**
     * Dispense avec logique FEFO + priorité OPENED
     */
    async dispense(params: DispenseParams, product: ProductDefinition): Promise<Dispensation[]> {
        // 1. Validation de l'Admission
        if (!params.admissionId) {
             throw new Error("Admission ID is required for dispensation.");
        }
        if (params.quantity <= 0) throw new Error("La quantité doit être positive.");

        const dispensations: Dispensation[] = [];

        if (params.mode === DispensationMode.FULL_PACK || (params.mode as any) === 'FULL_PACK') {
            // --- BOX CONSUMPTION MODE ---
            // Mark packs as DISPENSED (Sink)
            
            let packsToDispense: SerializedPack[] = [];

            if (params.targetPackIds && params.targetPackIds.length > 0) {
                // MANUAL SELECTION
                packsToDispense = params.targetPackIds
                    .map(id => serializedPackService.getPackById(id))
                    .filter(p => p !== null && p.status === PackStatus.SEALED) as SerializedPack[];
                
                if (packsToDispense.length !== params.targetPackIds.length) {
                    throw new Error("Certains lots sélectionnés ne sont plus disponibles ou scellés.");
                }
            } else {
                // AUTO FEFO SELECTION
                const availablePacks = serializedPackService.getPacks({ 
                    productId: params.productId,
                    status: PackStatus.SEALED
                }).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

                if (availablePacks.length < params.quantity) {
                    throw new Error(`Stock insuffisant. ${availablePacks.length} boîtes disponibles sur ${params.quantity} demandées.`);
                }
                packsToDispense = availablePacks.slice(0, params.quantity);
            }

            // CONSUME PACKS
            packsToDispense.forEach(pack => {
                // Update Pack State
                pack.status = PackStatus.DISPENSED;
                pack.locationId = `CONSUMED_BY_ADMISSION:${params.admissionId}`; // Logical Sink Trace
                pack.history.push({
                    date: new Date().toISOString(),
                    action: 'DISPENSE',
                    userId: params.userId,
                    details: `Dispensed to Admission ${params.admissionId}`
                });
                serializedPackService.updatePack(pack);

                // Create Dispensation Record
                const dispensation: Dispensation = {
                    id: `disp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    prescriptionId: params.prescriptionId,
                    admissionId: params.admissionId,
                    productId: params.productId,
                    productName: product.name, // Ensure Product Name
                    mode: params.mode,
                    quantity: 1, // 1 Box
                    serializedPackId: pack.id,
                    lotNumber: pack.batchNumber,
                    expiryDate: pack.expiryDate,
                    serialNumber: pack.serialNumber,
                    unitPriceExclVAT: (product.suppliers[0]?.purchasePrice || 0) * (1 + product.profitMargin / 100),
                    vatRate: product.vatRate,
                    totalPriceInclVAT: 0,
                    dispensedAt: new Date(),
                    dispensedBy: params.userId
                };
                // Calculate Total Price (Quantity is Boxes, UnitPrice is Box Price)
                dispensation.totalPriceInclVAT = dispensation.unitPriceExclVAT * dispensation.quantity * (1 + product.vatRate / 100);
                
                dispensations.push(dispensation);
                this.dispensations.push(dispensation);
            });

        } else {
             // --- UNIT MODE ---
             // Reuse existing unit logic
             return this.dispenseUnitsLegacy(params, product);
        }

        return dispensations;
    }

    // 3-TIER FEFO DISPENSATION LOGIC (Global Standard)
    private async dispenseUnitsLegacy(params: DispenseParams, product: ProductDefinition): Promise<Dispensation[]> {
        const dispensations: Dispensation[] = [];
        let remaining = params.quantity;
        const svc = PharmacyService.getInstance();

        // 1. CONSUME LOOSE UNITS (Priority #1)
        const looseUnits = svc.getLooseUnits(params.productId)
            .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        for (const unit of looseUnits) {
            if (remaining <= 0) break;
            
            const take = Math.min(remaining, unit.quantity);
            svc.removeLooseUnits(params.productId, take); // This handles the actual reduction/removal logic inside service
            
            // Create Dispensation (Loose)
            const dispensation: Dispensation = {
                id: `disp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                prescriptionId: params.prescriptionId,
                admissionId: params.admissionId,
                productId: params.productId,
                productName: product.name,
                mode: params.mode,
                quantity: take,
                serializedPackId: 'LOOSE_UNIT', // Marker
                lotNumber: unit.batchNumber,
                expiryDate: unit.expiryDate,
                serialNumber: 'VRAC',
                unitPriceExclVAT: ((product.suppliers[0]?.purchasePrice || 0) / product.unitsPerPack) * (1 + product.profitMargin / 100),
                vatRate: product.vatRate,
                totalPriceInclVAT: 0,
                dispensedAt: new Date(),
                dispensedBy: params.userId
            };
            dispensation.totalPriceInclVAT = dispensation.unitPriceExclVAT * take * (1 + product.vatRate / 100);
            dispensations.push(dispensation);
            this.dispensations.push(dispensation);

            remaining -= take;
        }

        if (remaining <= 0) return dispensations;

        // 2. CONSUME OPEN PACKS (Priority #2)
        // 3. CONSUME SEALED PACKS (Priority #3) (Auto-Open)
        
        let packs = serializedPackService.getPacks({ productId: params.productId })
            .filter(p => p.status === PackStatus.OPENED || p.status === PackStatus.SEALED);
            
        // Strict Sort: OPENED first, then by Expiry
        packs.sort((a, b) => {
             if (a.status === PackStatus.OPENED && b.status !== PackStatus.OPENED) return -1;
             if (b.status === PackStatus.OPENED && a.status !== PackStatus.OPENED) return 1;
             const dateA = new Date(a.expiryDate).getTime();
             const dateB = new Date(b.expiryDate).getTime();
             return dateA - dateB;
        });

        for (const pack of packs) {
            if (remaining <= 0) break;
            
            const availableInPack = pack.remainingUnits;
            const take = Math.min(remaining, availableInPack);
            
            // Consume
            pack.remainingUnits -= take;
            if (pack.status === PackStatus.SEALED) {
                pack.status = PackStatus.OPENED;
                pack.openedAt = new Date();
                pack.openedByUserId = params.userId;
            }
            if (pack.remainingUnits <= 0) {
                 pack.status = PackStatus.DISPENSED; // Fully consumed
            }
            serializedPackService.updatePack(pack);
            
            const dispensation: Dispensation = {
                id: `disp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                prescriptionId: params.prescriptionId,
                admissionId: params.admissionId,
                productId: params.productId,
                productName: product.name,
                mode: params.mode,
                quantity: take,
                serializedPackId: pack.id,
                lotNumber: pack.batchNumber,
                expiryDate: pack.expiryDate,
                serialNumber: pack.serialNumber,
                unitPriceExclVAT: ((product.suppliers[0]?.purchasePrice || 0) / product.unitsPerPack) * (1 + product.profitMargin / 100),
                vatRate: product.vatRate,
                totalPriceInclVAT: 0,
                dispensedAt: new Date(),
                dispensedBy: params.userId
            };
            dispensation.totalPriceInclVAT = dispensation.unitPriceExclVAT * take * (1 + product.vatRate / 100);
            
            dispensations.push(dispensation);
            this.dispensations.push(dispensation);
            
            remaining -= take;
        }

        if (remaining > 0) throw new Error(`Stock insuffisant. Manque ${remaining} unités.`);
        return dispensations;
    }

    /**
     * Récupère les dispensations par prescription
     */
    getDispensationsByPrescription(prescriptionId: string): Dispensation[] {
        return this.dispensations.filter(d => d.prescriptionId === prescriptionId);
    }

    /**
     * Récupère toutes les dispensations
     */
    getAllDispensations(): Dispensation[] {
        return [...this.dispensations];
    }
}

export const dispensationService = new DispensationService();
