
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// 1. Clients
const clients = [
    {
        id: "client_demo",
        type: "HOPITAL",
        designation: "Hôpital Demo Central",
        siege_social: "123 Rue de la Santé, Casablanca",
        representant_legal: "Dr. Directeur"
    }
];
fs.writeFileSync(path.join(DATA_DIR, 'clients.json'), JSON.stringify(clients, null, 2));

// 2. Roles
const roles = [
    { id: "role_super_admin", name: "Super Admin Global", code: "SUPER_ADMIN" }, // Publisher
    { id: "role_admin_struct", name: "Administrateur Structure", code: "ADMIN_STRUCTURE" }, // Tenant Admin
    { id: "role_medecin", name: "Médecin", code: "MEDECIN" },
    { id: "role_infirmier", name: "Infirmier", code: "INFIRMIER" },
    { id: "role_pharmacien", name: "Pharmacien", code: "PHARMACIEN" }
];
fs.writeFileSync(path.join(DATA_DIR, 'roles.json'), JSON.stringify(roles, null, 2));

// 3. Permissions (Basic set for now)
const permissions = [
    { id: "perm_view_patients", code: "VIEW_PATIENTS" },
    { id: "perm_edit_patients", code: "EDIT_PATIENTS" }
];
fs.writeFileSync(path.join(DATA_DIR, 'permissions.json'), JSON.stringify(permissions, null, 2));

// 4. Users
const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 10);

const users = [
    {
        id: "user_publisher_admin",
        username: "admin",
        password_hash: hashPassword("admin123"),
        nom: "System",
        prenom: "Admin",
        user_type: "PUBLISHER_SUPERADMIN",
        role_id: "role_super_admin",
        client_id: null
    },
    {
        id: "user_tenant_admin",
        username: "manager",
        password_hash: hashPassword("manager123"),
        nom: "Directeur",
        prenom: "Demo",
        user_type: "TENANT_SUPERADMIN",
        role_id: "role_admin_struct",
        client_id: "client_demo"
    },
    {
        id: "user_doctor_demo",
        username: "docteur",
        password_hash: hashPassword("doc123"),
        nom: "Dupont",
        prenom: "Jean",
        user_type: "TENANT_USER",
        role_id: "role_medecin",
        client_id: "client_demo",
        INPE: "123456789"
    },
    {
        id: "user_pharma_demo",
        username: "pharma",
        password_hash: hashPassword("pharma123"),
        nom: "Pharma",
        prenom: "Marie",
        user_type: "TENANT_USER",
        role_id: "role_pharmacien",
        client_id: "client_demo"
    }
];

fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));

console.log("Auth data initialized successfully.");
