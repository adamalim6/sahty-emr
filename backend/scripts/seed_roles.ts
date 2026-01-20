import { getGlobalDB } from '../db/globalDb';

const seedRoles = async () => {
    try {
        console.log('Seeding Global Roles...');
        const db = await getGlobalDB();
        
        const roles = [
            {
                id: 'role_super_admin',
                code: 'SUPER_ADMIN',
                name: 'Super Admin Global',
                description: 'Administrateur Global de la Plateforme',
                permissions: JSON.stringify(["sa_clients", "sa_organismes", "sa_roles", "sa_actes", "sa_products", "sa_users"])
            },
            {
                id: 'role_admin_struct',
                code: 'ADMIN_STRUCTURE',
                name: 'Administrateur Structure',
                description: 'Administrateur Principal d\'un Tenant (Client)',
                permissions: JSON.stringify(["st_users", "st_services", "st_rooms", "st_pricing", "st_roles", "st_pharmacy_view", "st_emr_view"])
            }
        ];

        for (const role of roles) {
            await new Promise<void>((resolve, reject) => {
                db.run(`
                    INSERT INTO global_roles (id, code, name, description, permissions)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name=excluded.name,
                        description=excluded.description,
                        permissions=excluded.permissions
                `, [role.id, role.code, role.name, role.description, role.permissions], (err) => {
                    if (err) {
                        console.error(`Failed to insert role ${role.id}:`, err.message);
                        reject(err);
                    } else {
                        console.log(`Upserted role: ${role.id}`);
                        resolve();
                    }
                });
            });
        }
        console.log('Roles seeded successfully.');
    } catch (e: any) {
        console.error('Error seeding roles:', e.message);
    }
};

seedRoles();
