import { Request, Response } from 'express';
import { getTenantId } from '../middleware/authMiddleware';
import { tenantQuery } from '../db/tenantPg';

const getContext = (req: Request) => {
    const tenantId = getTenantId(req as any);
    const user = (req as any).user;
    return { tenantId, user };
};

interface ServiceStockItem {
    productId: string;
    productName: string;
    sahtyCode: string | null;
    type: string | null;
    therapeuticClass: string | null;
    unitsPerBox: number | null;
    lot: string;
    expiry: string;
    location: string;
    locationName: string;
    qtyUnits: number;
    reservedUnits?: number;
    pendingReturnUnits?: number;
    availableUnits?: number;
}

interface ServiceInfo {
    id: string;
    name: string;
}

/**
 * GET /api/emr/service-stock
 * Returns stock for the current user's assigned service(s)
 * Queries current_stock joined with locations (scope=SERVICE) and products
 */
export const getServiceStock = async (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        
        // Get serviceId from query param or user's first assigned service
        let serviceId = req.query.serviceId as string;
        
        if (!serviceId) {
            const userServices = user?.service_ids || [];
            if (userServices.length === 0) {
                return res.json([]); // No services assigned
            }
            serviceId = userServices[0];
        }
        
        // Authorization: user must have access to requested service
        const userServices = user?.service_ids || [];
        const isAdmin = user?.user_type === 'TENANT_SUPERADMIN' || 
                       user?.user_type === 'TENANT_ADMIN' ||
                       user?.role_code === 'ADMIN_STRUCTURE' ||
                       user?.role_id === 'role_admin_struct';
        
        const hasAccess = isAdmin || userServices.some((sid: string) => 
            sid.toLowerCase().trim() === serviceId.toLowerCase().trim()
        );
        
        if (!hasAccess) {
            return res.status(403).json({ error: 'Accès refusé à ce service' });
        }
        
        // Step 1: Query current_stock from tenant DB (no products table in tenant)
        // Include reserved_units and pending_return_units for available stock calculation
        const stockQuery = `
            SELECT 
                cs.product_id,
                cs.lot,
                to_char(cs.expiry, 'YYYY-MM-DD') as expiry,
                cs.location_id as location,
                l.name as location_name,
                cs.qty_units,
                COALESCE(cs.reserved_units, 0) as reserved_units,
                COALESCE(cs.pending_return_units, 0) as pending_return_units,
                (cs.qty_units - COALESCE(cs.reserved_units, 0) - COALESCE(cs.pending_return_units, 0)) as available_units
            FROM current_stock cs
            JOIN locations l ON cs.location_id = l.location_id AND cs.tenant_id = l.tenant_id
            WHERE cs.tenant_id = $1 
              AND l.scope = 'SERVICE'
              AND l.service_id = $2::uuid
              AND cs.qty_units > 0
            ORDER BY l.name, cs.expiry
        `;
        
        const stockRows = await tenantQuery(tenantId, stockQuery, [tenantId, serviceId]);
        
        if (stockRows.length === 0) {
            return res.json([]);
        }
        
        // Step 2: Get unique product IDs
        const productIds = [...new Set(stockRows.map((r: any) => r.product_id))];
        
        // Step 3: Query global_products from sahty_global
        const { globalQuery } = await import('../db/globalPg');
        const placeholders = productIds.map((_, i) => `$${i + 1}`).join(', ');
        const productsQuery = `
            SELECT id, name, sahty_code, type, class_therapeutique, units_per_pack
            FROM global_products
            WHERE id IN (${placeholders})
        `;
        const productRows = await globalQuery(productsQuery, productIds);
        
        // Step 4: Create product lookup map
        const productMap = new Map<string, any>();
        productRows.forEach((p: any) => {
            productMap.set(p.id, {
                name: p.name,
                sahtyCode: p.sahty_code,
                type: p.type,
                therapeuticClass: p.class_therapeutique,
                unitsPerBox: p.units_per_pack
            });
        });
        
        // Step 5: Transform to frontend format
        const items: ServiceStockItem[] = stockRows.map((row: any) => {
            const product = productMap.get(row.product_id) || {};
            return {
                productId: row.product_id,
                productName: product.name || row.product_id,
                sahtyCode: product.sahtyCode || null,
                type: product.type || null,
                therapeuticClass: product.therapeuticClass || null,
                unitsPerBox: product.unitsPerBox || null,
                lot: row.lot,
                expiry: row.expiry,
                location: row.location,
                locationName: row.location_name,
                qtyUnits: row.qty_units,
                reservedUnits: row.reserved_units || 0,
                pendingReturnUnits: row.pending_return_units || 0,
                availableUnits: row.available_units ?? row.qty_units
            };
        });
        
        // Sort by product name
        items.sort((a, b) => a.productName.localeCompare(b.productName));
        
        res.json(items);
    } catch (error: any) {
        console.error('[getServiceStock] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/emr/user-services
 * Returns services assigned to the current user (for service selector)
 */
export const getUserServices = async (req: Request, res: Response) => {
    try {
        const { tenantId, user } = getContext(req);
        
        console.log('[getUserServices] tenantId:', tenantId);
        console.log('[getUserServices] user:', JSON.stringify(user, null, 2));
        
        const userServices = user?.service_ids || [];
        
        console.log('[getUserServices] userServices:', userServices);
        
        if (userServices.length === 0) {
            console.log('[getUserServices] No services assigned, returning empty');
            return res.json([]);
        }
        
        // Query service details - services table uses 'id' as primary key
        const placeholders = userServices.map((_: string, i: number) => `$${i + 2}::uuid`).join(', ');
        const query = `
            SELECT id, name 
            FROM services 
            WHERE tenant_id = $1 AND id IN (${placeholders})
            ORDER BY name
        `;
        
        const rows = await tenantQuery(tenantId, query, [tenantId, ...userServices]);
        
        console.log('[getUserServices] Query returned rows:', rows.length);
        
        const services: ServiceInfo[] = rows.map((row: any) => ({
            id: row.id,
            name: row.name
        }));
        
        res.json(services);
    } catch (error: any) {
        console.error('[getUserServices] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
