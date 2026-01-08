
import { SerializedPack, PackStatus, Dispensation, DispensationMode } from '../models/serialized-pack';
import { ProductDefinition } from '../models/pharmacy';

class SerializedPackService {
    private packs: SerializedPack[] = [];
    private packCounter = 1;

    constructor() {
        // Data is now injected from PharmacyService (Single Source of Truth)
    }

    /**
     * Inject persistent data
     */
    setPacks(packs: SerializedPack[]) {
        this.packs = packs; // Reference or Copy? 
        // Better to use a copy to avoid side-effects if pharmacyService modifies its array?
        // But we want to be the manager.
        // Let's copy.
        this.packs = [...packs];
    }
    
    // Removed initializeMockPacks as we rely on DB injection
    private initializeMockPacks() {}

    private addMockBatch(pid: string, batch: string, count: number, loc: string, units: number) {
        for (let i = 0; i < count; i++) {
             this.packs.push({
                id: `pack-${pid}-${batch}-${i}`,
                productId: pid,
                serialNumber: `SN-${batch}-${i}`,
                batchNumber: batch,
                expiryDate: '2030-01-01',
                locationId: loc,
                status: PackStatus.SEALED,
                unitsPerPack: units,
                remainingUnits: units,
                sourceDeliveryNoteId: 'MOCK-DELIVERY',
                history: [],
                createdAt: new Date()
            });
        }
    }

    /**
     * Transfère des boîtes vers un nouvel emplacement
     */
    transferPacks(params: {
        productId: string;
        batchNumber: string;
        quantity: number;
        toLocationId: string;
        reason?: string;
        userId?: string;
    }): SerializedPack[] {
        const pid = params.productId.trim();
        const batch = params.batchNumber.trim();

        // 1. Find sealed packs in pharmacy (no specific location filter, or main pharmacy)
        // We assume packs available for transfer are SEALED or OPENED and not in a service location yet?
        // Actually simplest is to find packs matching batch and product that are NOT already dispensed

        const candidatePacks = this.packs.filter(p =>
            p.productId.trim() === pid &&
            p.batchNumber.trim() === batch &&
            (p.status === PackStatus.SEALED || p.status === PackStatus.OPENED)
        ).sort((a, b) => {
            // Prioritize SEALED packs over OPENED packs to avoid transferring partial units as full boxes
            if (a.status === PackStatus.SEALED && b.status !== PackStatus.SEALED) return -1;
            if (a.status !== PackStatus.SEALED && b.status === PackStatus.SEALED) return 1;
            
            // Then sort by ID (FIFO equivalent if IDs are time-based/sequential)
            return a.id.localeCompare(b.id);
        });

        if (candidatePacks.length < params.quantity) {
             const msg = `CRITICAL: Attempted to transfer ${params.quantity} packs of ${pid} batch ${batch} but only found ${candidatePacks.length}. Aborting to preserve inventory integrity.`;
             console.error(msg);
             throw new Error(msg);
        }

        const packsToTransfer = candidatePacks.slice(0, params.quantity);
        // console.log(`[TransferPacks] Moving ${packsToTransfer.length} packs to ${params.toLocationId}. IDs: ${packsToTransfer.map(p => p.id).join(', ')}`);
        
        const transferred: SerializedPack[] = [];

        packsToTransfer.forEach(pack => {
            // Update the pack in the main array explicitly to be safe
            const mainIndex = this.packs.findIndex(p => p.id === pack.id);
            if (mainIndex !== -1) {
                // console.log(`[DEBUG] Updating Pack ${pack.id} Loc: ${this.packs[mainIndex].locationId} -> ${params.toLocationId}`);
                this.packs[mainIndex].locationId = params.toLocationId;
                this.packs[mainIndex].history.push({
                    date: new Date().toISOString(),
                    action: 'TRANSFER',
                    userId: params.userId || 'system',
                    details: params.reason || `Transfer to ${params.toLocationId}`
                });
                transferred.push(this.packs[mainIndex]);
            }
        });

        return transferred;
    }

    /**
     * Dispense packs from a service location
     */
    dispensePacks(params: {
        productId: string;
        batchNumber: string;
        locationId: string;
        quantity: number; // In Units? Or Packs? If we dispense specific packs, this should be number of packs? 
        // But the input is usually units or boxes.
        // If mode=BOX -> quantity is number of packs.
        // If mode=UNIT -> quantity is units. 
        // For simplicity here, let's assume we consume FULL PACKS if possible, or open them.
        // But dispenseFromServiceStock subtracts quantities.
        // Here we just want to mark X number of packs as DISPENSED for traceability.
        // Let's assume quantity is NUMBER OF FULL PACKS TO MARK AS DISPENSED (for Box mode).
        // For Unit mode, it's more complex (partial).
        mode: 'BOX' | 'UNIT';
        unitsPerPack: number;
        reason?: string;
        userId?: string;
    }): SerializedPack[] {
        // Find packs in this location
        // Prioritize OPENED, then SEALED? 
        // Actually for Service Exit, if I take a BOX, I take a SEALED box usually.
        // If I take UNITS, I might take from OPENED or open a new one.

        const packsInLocation = this.packs.filter(p =>
            p.productId === params.productId &&
            p.batchNumber === params.batchNumber &&
            (p.locationId === params.locationId || p.locationId.includes(params.locationId) || params.locationId === 'Service Médecine') // Demo fallback safety
            && (p.status === PackStatus.SEALED || p.status === PackStatus.OPENED)
        ).sort((a, b) => {
            // If BOX mode, maybe prefer SEALED?
            // If UNIT mode, prefer OPENED?
            if (params.mode === 'UNIT') {
                if (a.status === PackStatus.OPENED && b.status === PackStatus.SEALED) return -1;
                if (a.status === PackStatus.SEALED && b.status === PackStatus.OPENED) return 1;
            }
            return a.id.localeCompare(b.id);
        });

        // Determine how many packs to touch
        let packsToUpdate: SerializedPack[] = [];

        if (params.mode === 'BOX') {
            // Quantity is number of boxes
            packsToUpdate = packsInLocation.slice(0, params.quantity);

            packsToUpdate.forEach(pack => {
                pack.status = PackStatus.DISPENSED;
                pack.history.push({
                    date: new Date().toISOString(),
                    action: 'DISPENSE',
                    userId: params.userId || 'system',
                    details: params.reason || `Dispensed from service stock`
                });
            });
        } else {
            // MODE UNIT
            // This is harder. We might consume 1.5 boxes worth of units.
            // But usually we just want to track which packs were "touched" or depleted?
            // For rigorous serialization, we should track exactly which pack gave which unit.
            // But typically in this UI we just want to decrement availability.
            // If we consume units, we might OPEN a pack.

            let unitsNeeded = params.quantity;
            for (const pack of packsInLocation) {
                if (unitsNeeded <= 0) break;

                // If pack is sealed, it becomes opened
                if (pack.status === PackStatus.SEALED) {
                    pack.status = PackStatus.OPENED;
                    pack.history.push({
                        date: new Date().toISOString(),
                        action: 'OPEN',
                        userId: params.userId || 'system',
                        details: 'Opened for unit consumption'
                    });
                }

                // Consume from this pack
                // We don't have exact 'remainingUnits' tracking synced perfectly everywhere yet,
                // but let's assume we use this pack.
                // If we consume the whole remainder of the pack, set to DISPENSED?
                // Or just keep it OPENED?
                // For 'Sortie Pharmacie', if I take a pill, the box stays in the cupboard (OPENED).
                // It is NOT DISPENSED (unless empty).
                // So really we just ensure we have enough OPEN/SEALED packs to cover it.
                // But wait, the user wants "Sortie Pharmacie" -> This implies the medication LEAVES the stock?
                // If I give a pill to a patient, it leaves the stock.
                // But the BOX stays. 

                // So for UNIT mode:
                // We just mark it touched/opened?
                // If we strictly want to prevent re-dispensing the SAME unit, we need `remainingUnits`.
                // Let's reduce `remainingUnits`.

                const availableInPack = pack.remainingUnits ?? params.unitsPerPack;
                const take = Math.min(unitsNeeded, availableInPack);

                pack.remainingUnits = availableInPack - take;
                unitsNeeded -= take;

                if (pack.remainingUnits <= 0) {
                    pack.status = PackStatus.DISPENSED; // Empty
                    pack.history.push({
                        date: new Date().toISOString(),
                        action: 'DISPENSE',
                        userId: params.userId || 'system',
                        details: 'Empty after unit consumption'
                    });
                }
                packsToUpdate.push(pack);
            }
        }

        return packsToUpdate;
    }

    /**
     * Génère un numéro de série unique
     */
    generateSerialNumber(): string {
        const timestamp = Date.now();
        const counter = this.packCounter++;
        return `SN-${timestamp}-${String(counter).padStart(6, '0')}`;
    }

    /**
     * Crée des boîtes sérialisées depuis un lot en quarantaine
     */
    createPacksFromBatch(params: {
        productId: string;
        lotNumber: string;
        expiryDate: string;
        locationId: string;
        quantityInPacks: number;
        unitsPerPack: number;
        deliveryNoteId: string;
    }): SerializedPack[] {
        const packs: SerializedPack[] = [];

        const timestamp = Date.now();
        const batchRandom = Math.floor(Math.random() * 10000);

        for (let i = 0; i < params.quantityInPacks; i++) {
            const pack: SerializedPack = {
                id: `pack-${timestamp}-${batchRandom}-${i}`, // Guaranteed unique
                productId: params.productId,
                serialNumber: this.generateSerialNumber(),
                batchNumber: params.lotNumber,
                expiryDate: params.expiryDate,
                locationId: params.locationId,
                status: PackStatus.SEALED,
                unitsPerPack: params.unitsPerPack,
                remainingUnits: params.unitsPerPack,
                sourceDeliveryNoteId: params.deliveryNoteId,
                history: [],
                createdAt: new Date()
            };

            packs.push(pack);
            this.packs.push(pack);
        }

        return packs;
    }

    /**
     * Récupère les boîtes avec filtres
     */
    getPacks(filters?: {
        productId?: string;
        status?: PackStatus;
        locationId?: string;
        expiringBefore?: Date;
    }): SerializedPack[] {
        let result = [...this.packs];

        if (filters) {
            if (filters.productId) {
                result = result.filter(p => p.productId === filters.productId);
            }
            if (filters.status) {
                result = result.filter(p => p.status === filters.status);
            }
            if (filters.locationId) {
                result = result.filter(p => p.locationId === filters.locationId);
            }
            if (filters.expiringBefore) {
                result = result.filter(p =>
                    new Date(p.expiryDate) <= filters.expiringBefore!
                );
            }
        }

        return result;
    }

    /**
     * Récupère une boîte par ID
     */
    getPackById(id: string): SerializedPack | null {
        return this.packs.find(p => p.id === id) || null;
    }

    /**
     * Met à jour une boîte
     */
    updatePack(pack: SerializedPack): void {
        const index = this.packs.findIndex(p => p.id === pack.id);
        if (index !== -1) {
            this.packs[index] = pack;
        }
    }

    /**
     * Récupère toutes les boîtes
     */
    getAllPacks(): SerializedPack[] {
        return [...this.packs];
    }
}

export const serializedPackService = new SerializedPackService();
