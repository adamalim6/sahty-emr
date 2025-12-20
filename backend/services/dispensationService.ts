
import { Dispensation, DispensationMode, SerializedPack, PackStatus } from '../models/serialized-pack';
import { ProductDefinition } from '../models/pharmacy';
import { serializedPackService } from './serializedPackService';

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
        const statuses = mode === DispensationMode.FULL_PACK
            ? [PackStatus.SEALED]
            : [PackStatus.OPENED, PackStatus.SEALED];

        const packs = serializedPackService.getPacks({
            productId,
            status: undefined
        }).filter(p => statuses.includes(p.status));

        if (mode === DispensationMode.FULL_PACK) {
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
        // 1. Vérifier subdivisibilité
        if (params.mode === DispensationMode.UNIT && !product.isSubdivisable) {
            throw new Error('Ce produit n\'est pas subdivisible. Utilisez le mode "Boîte Complète".');
        }

        // 2. Sélectionner les boîtes avec FEFO + priorité OPENED
        const statuses = params.mode === DispensationMode.FULL_PACK
            ? [PackStatus.SEALED]
            : [PackStatus.OPENED, PackStatus.SEALED];

        let packs = serializedPackService.getPacks({
            productId: params.productId
        }).filter(p => statuses.includes(p.status));

        // Manual Selection Filter
        if (params.targetPackIds && params.targetPackIds.length > 0) {
            packs = packs.filter(p => params.targetPackIds!.includes(p.id));
            if (packs.length < params.targetPackIds.length) {
                // Warning: some requested packs might not be available/valid status
                console.warn("Some requested packs were not found or not available.");
            }
        }

        // Tri FEFO avec priorité OPENED
        packs.sort((a, b) => {
            // Priorité 1: OPENED avant SEALED
            if (a.status === PackStatus.OPENED && b.status !== PackStatus.OPENED) return -1;
            if (b.status === PackStatus.OPENED && a.status !== PackStatus.OPENED) return 1;

            // Priorité 2: Date de péremption (FEFO)
            const dateA = new Date(a.expiryDate).getTime();
            const dateB = new Date(b.expiryDate).getTime();
            if (dateA !== dateB) return dateA - dateB;

            // Priorité 3: Date de création
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        // 3. Prélever les unités
        let remainingToDispense = params.quantity;
        const dispensations: Dispensation[] = [];

        for (const pack of packs) {
            if (remainingToDispense <= 0) break;

            let toTake: number;

            if (params.mode === DispensationMode.FULL_PACK) {
                // Mode boîte complète
                if (pack.status === PackStatus.SEALED && pack.remainingUnits === pack.unitsPerPack) {
                    toTake = pack.unitsPerPack;
                } else {
                    continue;
                }
            } else {
                // Mode unité
                toTake = Math.min(pack.remainingUnits, remainingToDispense);
            }

            // Mettre à jour la boîte
            pack.remainingUnits -= toTake;

            if (pack.status === PackStatus.SEALED && toTake > 0) {
                pack.status = PackStatus.OPENED;
                pack.openedAt = new Date();
                pack.openedByUserId = params.userId;
            }

            if (pack.remainingUnits === 0) {
                pack.status = PackStatus.EMPTY;
            }

            serializedPackService.updatePack(pack);

            // Calculer les prix
            const supplier = product.suppliers[0]; // Prendre le premier fournisseur
            const purchasePrice = supplier?.purchasePrice || 0;
            const priceWithMargin = purchasePrice * (1 + product.profitMargin / 100);
            const unitPriceExclVAT = priceWithMargin;
            const totalPriceInclVAT = unitPriceExclVAT * toTake * (1 + product.vatRate / 100);

            // Créer la dispensation
            const dispensation: Dispensation = {
                id: `disp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                prescriptionId: params.prescriptionId,
                admissionId: params.admissionId,
                productId: params.productId,
                mode: params.mode,
                quantity: toTake,
                serializedPackId: pack.id,
                lotNumber: pack.lotNumber,
                expiryDate: pack.expiryDate,
                serialNumber: pack.serialNumber,
                unitPriceExclVAT,
                vatRate: product.vatRate,
                totalPriceInclVAT,
                dispensedAt: new Date(),
                dispensedBy: params.userId
            };

            dispensations.push(dispensation);
            this.dispensations.push(dispensation);
            remainingToDispense -= toTake;
        }

        // 4. Vérifier succès
        if (remainingToDispense > 0) {
            throw new Error(`Stock insuffisant. ${remainingToDispense} unité(s) manquante(s).`);
        }

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
