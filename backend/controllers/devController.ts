
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcryptjs';
import { TenantStore } from '../utils/tenantStore';
import { globalAdminService } from '../services/globalAdminService';
import { User, UserType } from '../models/auth';

const DATA_ROOT = path.resolve(__dirname, '../data');
const TENANTS_DIR = path.join(DATA_ROOT, 'tenants');
const GLOBAL_DIR = path.join(DATA_ROOT, 'global');

const SEED_ROLES = [
  {
    "id": "role_super_admin",
    "name": "Super Admin Global",
    "code": "SUPER_ADMIN",
    "permissions": ["sa_clients", "sa_organismes", "sa_roles", "sa_actes"]
  },
  {
    "id": "role_admin_struct",
    "name": "Administrateur Structure",
    "code": "ADMIN_STRUCTURE",
    "permissions": ["st_users", "st_services", "st_rooms", "st_pricing", "st_roles"],
    "modules": ["SETTINGS", "PHARMACY", "EMR"]
  },
  {
    "id": "role_medecin",
    "name": "Médecin",
    "code": "MEDECIN",
    "permissions": ["emr_patients", "emr_dossier", "emr_admissions", "emr_calendar", "emr_waiting_room", "emr_map"],
    "modules": ["EMR"]
  },
  {
    "id": "role_infirmier",
    "name": "Infirmier",
    "code": "INFIRMIER",
    "permissions": ["emr_patients", "emr_dossier", "emr_admissions", "emr_waiting_room", "emr_map", "emr_replenishment", "emr_service_stock"],
    "modules": ["EMR"]
  },
  {
    "id": "role_pharmacien",
    "name": "Pharmacien",
    "code": "PHARMACIEN",
    "permissions": ["ph_dashboard", "ph_prescriptions", "ph_catalog", "ph_entry", "ph_quarantine", "ph_suppliers", "ph_stockout", "ph_returns", "ph_partners", "ph_locations", "ph_inventory", "ph_stock", "ph_requests"],
    "modules": ["PHARMACY"]
  }
];

export const resetData = (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Not allowed in production' });
    }
    
    try {
        console.warn("!!! SYSTEM RESET TRIGGERED !!!");
        
        // Wipe Tenants
        if (fs.existsSync(TENANTS_DIR)) {
            fs.rmSync(TENANTS_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TENANTS_DIR, { recursive: true });
        
        // Reset Global Patients
        if (!fs.existsSync(GLOBAL_DIR)) fs.mkdirSync(GLOBAL_DIR, { recursive: true });
        const patientsFile = path.join(GLOBAL_DIR, 'patients.json');
        fs.writeFileSync(patientsFile, '[]');

        // Reset Clients Registry (SuperAdmin view)
        const clientsFile = path.join(DATA_ROOT, 'clients.json');
        const usersFile = path.join(DATA_ROOT, 'users.json'); // Global User Registry often used by SuperAdmin or legacy
        
        // Seed Default Client 'demo' in Registry
        const demoClient = {
            id: 'demo',
            type: 'HOPITAL',
            designation: 'Hôpital Demo Central',
            siege_social: '123 Rue de la Santé, Casablanca',
            representant_legal: 'Dr. Directeur'
        };
        fs.writeFileSync(clientsFile, JSON.stringify([demoClient], null, 2));
        
        // We generally wipe users.json but might need to seed the SuperAdmin there if that's where auth checks?
        // Current Global Auth checks global/admins.json. 
        // Current Tenant Auth checks tenants/demo/settings.json.
        // users.json seems to be legacy or used by SuperAdmin to track DSI users.
        // Let's seed the DSI user for demo in users.json to keep SuperAdmin dashboard consistent.
        const demoDsiUser = {
            id: 'user_dsi_demo',
            username: 'admin', // The tenant admin
            password_hash: bcrypt.hashSync('admin', 10),
            nom: 'Directeur',
            prenom: 'Admin',
            user_type: 'TENANT_SUPERADMIN',
            role_id: 'role_admin_struct',
            tenantId: 'demo'
        };
        fs.writeFileSync(usersFile, JSON.stringify([demoDsiUser], null, 2));
        

        // Reset Global Admins
        const adminsFile = path.join(GLOBAL_DIR, 'admins.json');
        const defaultAdmin: User = {
            id: 'global_admin',
            tenantId: 'GLOBAL', 
            username: 'admin',
            password_hash: bcrypt.hashSync('admin123', 10),
            nom: 'SuperAdmin',
            prenom: 'Global',
            user_type: UserType.SUPER_ADMIN,
            role_code: 'SUPER_ADMIN',
            role_id: 'role_super_admin',
            active: true
        };
        // Use service to create (manually to bypass checks if any, or just direct write for reset)
        // Direct write is safer for reset tool to avoid circular deps or logic traps
        fs.writeFileSync(adminsFile, JSON.stringify([defaultAdmin], null, 2));
        
        // SEED Default Tenant 'demo'
        const tenantId = 'demo';
        const store = new TenantStore(tenantId);
        
        // Seed Settings
        const settings: any = {
            users: [],
            roles: SEED_ROLES, // Seed roles
            services: [],
            unitTypes: [],
            serviceUnits: [],
            pricing: [],
            rooms: []
        };
        
        // Seed Admin User
        const adminUser: User = {
            id: 'user_admin',
            tenantId: tenantId,
            username: 'admin',
            password_hash: bcrypt.hashSync('admin', 10),
            nom: 'Admin',
            prenom: 'System',
            user_type: UserType.TENANT_USER, // or similar
            role_id: 'role_admin_struct',
            INPE: '000000',
            service_ids: [],
            active: true
        };
        settings.users.push(adminUser);
        
        store.save('settings', settings);
        
        // Seed Pharmacy
        store.save('pharmacy', {
            inventory: [], catalog: [], locations: [], partners: [], stockOutHistory: [],
            productVersions: [], purchaseOrders: [], deliveryNotes: [], serializedPacks: [],
            looseUnits: [], dispensations: [], suppliers: [], replenishmentRequests: [],
            pharmacyLedger: [], serviceLedgers: {}, movementLogs: [], returnRequests: [], containers: []
        });

        // Seed EMR
        store.save('emr_admissions', {
             admissions: [], appointments: [], consumptions: []
        });
        
        res.json({ message: 'System Hard Reset Complete. Tenant "demo" (admin/admin) and Global Admin (admin/admin123) restored.' });
    } catch (error: any) {
        console.error("Reset failed:", error);
        res.status(500).json({ error: error.message });
    }
};
