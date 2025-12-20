
import { SerializedPack, PackStatus, Dispensation, DispensationMode } from '../models/serialized-pack';
import { ProductDefinition } from '../models/pharmacy';

class SerializedPackService {
    private packs: SerializedPack[] = [];
    private packCounter = 1;

    constructor() {
        this.initializeMockPacks();
    }

    /**
     * Initialise des boîtes mockées pour la démo
     */
    private initializeMockPacks() {
        // Mock data removed
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
                lotNumber: params.lotNumber,
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
