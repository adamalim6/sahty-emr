
import { ReturnRequest, ReturnRequestItem, ReturnRequestStatus, ReturnDestination } from '../models/return-request';
import { Container, ContainerType, ContainerState, ContainerMovement } from '../models/container';
import { pharmacyService } from './pharmacyService';
import { serializedPackService } from './serializedPackService';
import { emrService } from './emrService';
import * as fs from 'fs';
import * as path from 'path';

// Helper for ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const DATA_DIR = path.join(__dirname, '../data');
const RETURNS_DB = path.join(DATA_DIR, 'returns_db.json');
const CONTAINERS_DB = path.join(DATA_DIR, 'containers_db.json');

export class ReturnService {
    private requests: ReturnRequest[] = [];
    private containers: Container[] = [];
    private static instance: ReturnService;

    constructor() {
        this.loadData();
    }

    public static getInstance(): ReturnService {
        if (!ReturnService.instance) {
            ReturnService.instance = new ReturnService();
        }
        return ReturnService.instance;
    }

    private saveData() {
        try {
            fs.writeFileSync(RETURNS_DB, JSON.stringify(this.requests, null, 2));
            fs.writeFileSync(CONTAINERS_DB, JSON.stringify(this.containers, null, 2));
        } catch (error) {
            console.error('Error saving returns data:', error);
        }
    }

    private loadData() {
        try {
            if (fs.existsSync(RETURNS_DB)) {
                this.requests = JSON.parse(fs.readFileSync(RETURNS_DB, 'utf-8'));
            }
            if (fs.existsSync(CONTAINERS_DB)) {
                this.containers = JSON.parse(fs.readFileSync(CONTAINERS_DB, 'utf-8'));
            }
        } catch (error) {
            console.error('Error loading returns data:', error);
        }
    }

    // --- Core Methods ---

    public createReturnRequest(
        admissionId: string,
        items: {
            productId: string;
            quantity: number;
            condition: 'SEALED' | 'OPENED';
            sourceType: 'PHARMACY' | 'SERVICE';
            serialNumber?: string; // If Box
            batchNumber: string;
            expiryDate: string;
            parentContainerId?: string; // If derived from existing container
            dispensationId?: string;
        }[],
        destination: ReturnDestination,
        userId: string,
        targetLocationId?: string,
        serviceId?: string
    ): ReturnRequest {

        const requestItems: ReturnRequestItem[] = items.map(item => {
            // Logic to create/identify container

            let container: Container;

            // Scenario 1: Returning a Box (Sealed or Opened)
            if (item.serialNumber) {
                // Find or create container representation for this serial
                // In reality, we should check if this Serial exists in dispensed packs
                // For this implementation, we assume we create a RETURNED_BOX container

                const productId = item.productId;
                const activeVersion = pharmacyService.getActiveProductVersion(productId);

                container = {
                    id: generateId(),
                    type: ContainerType.RETURNED_BOX,
                    productId: item.productId,
                    productVersionId: activeVersion?.id,
                    serialNumber: item.serialNumber, // PRESERVE SERIAL
                    lotNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    parentContainerId: undefined, // It IS the box
                    dispensationId: item.dispensationId,
                    originLocation: item.sourceType === 'PHARMACY' ? 'CENTRAL_PHARMACY' : 'SERVICE_STOCK',
                    currentLocation: 'TRANSIT',
                    unitsPerPack: activeVersion?.unitsPerPack || 1, // Fallback
                    availableBoxes: 1, // It's a box
                    availableUnits: item.condition === 'SEALED' ? (activeVersion?.unitsPerPack || 0) : item.quantity, // If opened, quantity is remaining units
                    state: ContainerState.RETURNED_PENDING_QA,
                    history: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
            } else {
                // Scenario 2: Returning Units (Loose)
                // Must have parentContainerId ideally, or at least batch info
                // Per rules: "Toute unité doit garder à vie une référence à la boîte mère"
                // So item.parentContainerId SHOULD be provided from frontend (selected from dispensation details)

                const activeVersion = pharmacyService.getActiveProductVersion(item.productId);

                container = {
                    id: generateId(),
                    type: ContainerType.RETURNED_UNIT_BATCH,
                    productId: item.productId,
                    productVersionId: activeVersion?.id,
                    serialNumber: undefined, // Units don't have serial, but specific LOT
                    lotNumber: item.batchNumber,
                    expiryDate: item.expiryDate,
                    parentContainerId: item.parentContainerId, // VITAL
                    dispensationId: item.dispensationId,
                    originLocation: item.sourceType === 'PHARMACY' ? 'CENTRAL_PHARMACY' : 'SERVICE_STOCK',
                    currentLocation: 'TRANSIT',
                    unitsPerPack: activeVersion?.unitsPerPack || 1,
                    availableBoxes: 0,
                    availableUnits: item.quantity,
                    state: ContainerState.RETURNED_PENDING_QA,
                    history: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
            }

            this.containers.push(container);

            // Log movement
            this.logMovement(container.id, 'RETURN', 'ADMISSION', destination, userId);

            return {
                containerId: container.id,
                quantity: item.quantity,
                type: container.type,
                condition: item.condition,
                dispensationId: item.dispensationId
            };
        });

        const request: ReturnRequest = {
            id: generateId(),
            admissionId,
            items: requestItems,
            destination,
            targetLocationId,
            serviceId,
            status: ReturnRequestStatus.PENDING_QA,
            createdAt: new Date(),
            createdBy: userId
        };

        this.requests.push(request);
        this.saveData();

        // Auto-Approvel Logic for Service Stock Return
        if (destination === ReturnDestination.SERVICE_STOCK) {
            try {
                // Automatically approve as "APPROVE_NORMAL" (move to stock)
                // This triggers inventory update via processReturnDecision logic
                this.processReturnDecision(request.id, 'APPROVE_NORMAL', userId);
            } catch (error) {
                console.error("Auto-approval failed for Service Stock return", error);
                // Status remains PENDING_QA if fail, or handle otherwise?
                // Ideally this shouldn't fail if request exists.
            }
        }

        return request;
    }

    public getPendingRequests(): any[] {
        return this.enrichRequests(this.requests.filter(r => r.status === ReturnRequestStatus.PENDING_QA));
    }

    public getAllRequests(): any[] {
        return this.enrichRequests(this.requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }

    public getReturnsByAdmission(admissionId: string): any[] {
        return this.enrichRequests(this.requests.filter(r => r.admissionId === admissionId));
    }

    private enrichRequests(requests: ReturnRequest[]): any[] {
        return requests.map(req => {
            const enrichedItems = req.items.map(item => {
                const container = this.containers.find(c => c.id === item.containerId);
                const productId = container ? container.productId : 'unknown';
                const product = pharmacyService.getProductById(productId);

                return {
                    ...item,
                    productId: productId,
                    productName: product ? product.name : 'Produit Inconnu',
                    lotNumber: container ? container.lotNumber : 'N/A',
                    expiryDate: container ? container.expiryDate : 'N/A'
                };
            });

            // EMR Data Enrichment
            const admission = emrService.getAllAdmissions().find(a => a.id === req.admissionId);
            const patient = admission ? emrService.getPatientById(admission.patientId) : undefined;

            return {
                ...req,
                items: enrichedItems,
                patientName: patient ? `${patient.lastName} ${patient.firstName}` : 'Inconnu',
                serviceName: admission ? admission.service : 'Service Inconnu',
                admissionDisplay: admission ? admission.nda : req.admissionId,
                senderName: req.createdBy === 'CURRENT_USER' ? 'M. Alami' : req.createdBy // Mocking 'CURRENT_USER' to a real name for demo if needed, or just keeping ID
            };
        });
    }

    public processReturnDecision(requestId: string, decision: 'APPROVE_NORMAL' | 'APPROVE_DONATION' | 'REJECT' | 'REPACK', userId: string) {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) throw new Error('Request not found');

        request.qaDecisionBy = userId;
        request.qaDecisionAt = new Date();

        if (decision === 'REJECT') {
            request.status = ReturnRequestStatus.REJECTED;
            // Update containers
            request.items.forEach(item => {
                const container = this.containers.find(c => c.id === item.containerId);
                if (container) {
                    container.state = ContainerState.DESTROYED;
                    this.logMovement(container.id, 'DESTRUCTION', 'PHARMACY_QA', 'DESTRUCTION_ZONE', userId);
                }
            });
        } else {
            if (decision === 'REPACK') {
                request.status = ReturnRequestStatus.REPACKED;
            } else {
                request.status = ReturnRequestStatus.APPROVED;
            }

            // Update containers
            request.items.forEach(item => {
                const container = this.containers.find(c => c.id === item.containerId);
                if (container) {
                    if (decision === 'APPROVE_NORMAL' || decision === 'REPACK') {
                        container.state = ContainerState.APPROVED_NORMAL;
                        container.currentLocation = 'PHARMACY_STOCK';
                    } else if (decision === 'APPROVE_DONATION') {
                        container.state = ContainerState.APPROVED_DONATION;
                        container.currentLocation = 'PHARMACY_DONATION_STOCK';
                    }
                    this.logMovement(container.id, 'QA_DECISION', 'PHARMACY_QA', container.currentLocation, userId, { decision });

                    if (request.destination === 'SERVICE_STOCK' && request.targetLocationId) {
                        pharmacyService.processServiceReturn({
                            productId: container.productId,
                            batchNumber: container.lotNumber,
                            expiryDate: container.expiryDate,
                            quantity: container.availableUnits,
                            condition: container.availableUnits === container.unitsPerPack ? 'SEALED' : 'OPENED',
                            locationId: request.targetLocationId,
                            serviceId: request.serviceId
                        });
                    } else {
                        // Update PharmacyService inventory
                        pharmacyService.processValidatedReturn({
                            productId: container.productId,
                            batchNumber: container.lotNumber,
                            expiryDate: container.expiryDate,
                            quantity: container.availableUnits,
                            condition: decision === 'REPACK' ? 'SEALED' : (container.availableUnits === container.unitsPerPack ? 'SEALED' : 'OPENED'),
                            isBox: container.type === 'RETURNED_BOX',
                            serialNumber: container.serialNumber
                        });
                    }

                    // Update Dispensation Status if linked
                    if (container.dispensationId) {
                        pharmacyService.markDispensationAsReturned(container.dispensationId, container.availableUnits);
                    }
                }
            });
        }

        this.saveData();
    }

    private logMovement(containerId: string, type: any, from: string, to: string, userId: string, details?: any) {
        const container = this.containers.find(c => c.id === containerId);
        if (container) {
            container.history.push({
                id: generateId(),
                type,
                date: new Date(),
                fromLocation: from,
                toLocation: to,
                userId,
                details
            });
        }
    }

    public processReturnSplitDecision(requestId: string, decisions: { containerId: string, actions: { decision: 'APPROVE_NORMAL' | 'APPROVE_DONATION' | 'REJECT' | 'REPACK', quantity: number }[] }[], userId: string) {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) throw new Error('Request not found');

        request.qaDecisionBy = userId;
        request.qaDecisionAt = new Date();
        request.status = ReturnRequestStatus.APPROVED; // Mark request as handled (or use a dedicated MIXED status if preferred)

        decisions.forEach(split => {
            const container = this.containers.find(c => c.id === split.containerId);
            if (!container) return;

            split.actions.forEach(action => {
                if (action.quantity <= 0) return;

                // Validate Quantity availability is handled by frontend/trust, but ideally we check here
                if (container.availableUnits < action.quantity) {
                    // console.warn(`Not enough units in container ${container.id} for action`);
                    // Ensure we don't go negative? For now assuming frontend validation
                }

                // Decrement original container availability (consuming the return)
                container.availableUnits = Math.max(0, container.availableUnits - action.quantity);
                if (container.availableUnits === 0) {
                    container.state = ContainerState.APPROVED_NORMAL; // Or generic processed state
                }

                if (action.decision === 'REJECT') {
                    this.logMovement(container.id, 'DESTRUCTION', 'PHARMACY_QA', 'DESTRUCTION_ZONE', userId, { quantity: action.quantity });
                } else {
                    // APPROVED or REPACKED
                    const isRepack = action.decision === 'REPACK';

                    // Log movement
                    this.logMovement(container.id, 'QA_DECISION', 'PHARMACY_QA', 'PHARMACY_STOCK', userId, { decision: action.decision, quantity: action.quantity });

                    if (request.destination === 'SERVICE_STOCK' && request.targetLocationId) {
                        pharmacyService.processServiceReturn({
                            productId: container.productId,
                            batchNumber: container.lotNumber,
                            expiryDate: container.expiryDate,
                            quantity: action.quantity,
                            condition: isRepack ? 'SEALED' : (action.quantity === container.unitsPerPack ? 'SEALED' : 'OPENED'), // Simplification
                            locationId: request.targetLocationId,
                            serviceId: request.serviceId
                        });
                    } else {
                        pharmacyService.processValidatedReturn({
                            productId: container.productId,
                            batchNumber: container.lotNumber,
                            expiryDate: container.expiryDate,
                            quantity: action.quantity,
                            condition: isRepack ? 'SEALED' : (action.quantity === container.unitsPerPack ? 'SEALED' : 'OPENED'),
                            isBox: container.type === 'RETURNED_BOX', // If we split a box into units, it might become units. But here we assume units.
                            serialNumber: container.serialNumber // If splitting quantity, serial might be tricky if it was 1 box. Assumes loose units mostly.
                        });
                    }

                    if (container.dispensationId) {
                        pharmacyService.markDispensationAsReturned(container.dispensationId, action.quantity);
                    }
                }
            });
        });

        this.saveData();
    }
}

export const returnService = ReturnService.getInstance();
