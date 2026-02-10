/**
 * Placement Controller — Rooms, Beds, and Patient Stays (physical placement)
 */

import { Response } from 'express';
import { AuthRequest, getTenantId } from '../middleware/authMiddleware';
import { placementService } from '../services/placementService';

const getContext = (req: any) => {
    const tenantId = getTenantId(req);
    return { tenantId, user: req.user };
};

// --- ROOMS (physical) ---

export const getServiceRooms = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const serviceId = req.params.serviceId;
        const rooms = serviceId
            ? await placementService.getRoomsByService(tenantId, serviceId)
            : await placementService.getAllRooms(tenantId);
        res.json(rooms);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createPhysicalRoom = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const room = await placementService.createRoom(tenantId, {
            serviceId: req.body.serviceId || req.body.service_id,
            roomTypeId: req.body.roomTypeId || req.body.room_type_id,
            name: req.body.name,
            description: req.body.description,
        });
        res.status(201).json(room);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const updatePhysicalRoom = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const room = await placementService.updateRoom(tenantId, req.params.id, req.body);
        res.json(room);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deactivatePhysicalRoom = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        await placementService.deactivateRoom(tenantId, req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// --- BEDS ---

export const getBeds = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const beds = await placementService.getBedsByRoom(tenantId, req.params.roomId);
        res.json(beds);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createBed = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const bed = await placementService.createBed(tenantId, {
            roomId: req.params.roomId,
            label: req.body.label,
        });
        res.status(201).json(bed);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const updateBedStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const bed = await placementService.updateBedStatus(tenantId, req.params.bedId, req.body.status);
        res.json(bed);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deactivateBed = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        await placementService.deactivateBed(tenantId, req.params.bedId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// --- STAYS ---

export const getAdmissionStays = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const stays = await placementService.getStaysByAdmission(tenantId, req.params.admissionId);
        res.json(stays);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const assignBed = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const stay = await placementService.assignInitialBed(
            tenantId, req.params.admissionId, req.body.tenantPatientId, req.body.bedId
        );
        res.status(201).json(stay);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const transferBed = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const stay = await placementService.transferBed(
            tenantId, req.params.admissionId, req.body.toBedId
        );
        res.json(stay);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getBedOccupancy = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId } = getContext(req);
        const data = await placementService.getActiveBedOccupancy(tenantId, req.params.serviceId);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
