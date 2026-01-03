
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'backend', 'data');

const files = {
    users: 'users.json',
    emr: 'emr_db.json',
    pharmacy: 'pharmacy_db.json',
    prescriptions: 'prescriptions_db.json',
    executions: 'executions_db.json',
    containers: 'containers_db.json',
    returns: 'returns_db.json',
    pricing: 'pricing.json',
    services: 'services.json',
    rooms: 'rooms.json',
    service_units: 'service_units.json'
};

function resetData() {
    console.log("Starting GLOBAL RESET of Tenant Operational Data...");

    // 1. Reset Users (Keep Super Admin & DSI)
    const usersPath = path.join(DATA_DIR, files.users);
    if (fs.existsSync(usersPath)) {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const keptUsers = users.filter((u: any) => 
            u.user_type === 'PUBLISHER_SUPERADMIN' || 
            (u.user_type === 'TENANT_SUPERADMIN' && u.role_id === 'role_admin_struct')
        );
        fs.writeFileSync(usersPath, JSON.stringify(keptUsers, null, 2));
        console.log(`Users reset. Kept ${keptUsers.length} admins. Deleted ${users.length - keptUsers.length} users.`);
    }

    // 2. Wipe Arrays (Set to empty array)
    const arrayFiles = [
        files.prescriptions,
        files.executions,
        files.containers, // Pharmacy containers
        files.returns,    // Pharmacy returns
        files.pricing,    // Tenant pricing
        files.services,   // Tenant services
        files.rooms,      // Tenant rooms
        files.service_units // Tenant service units
    ];

    arrayFiles.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        if (fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify([], null, 2));
            console.log(`Wiped ${file}.`);
        }
    });

    // 3. Reset EMR DB (Object with array keys)
    const emrPath = path.join(DATA_DIR, files.emr);
    if (fs.existsSync(emrPath)) {
        const emrDb = JSON.parse(fs.readFileSync(emrPath, 'utf8'));
        const newEmrDb: any = {};
        Object.keys(emrDb).forEach(key => {
            newEmrDb[key] = [];
        });
        fs.writeFileSync(emrPath, JSON.stringify(newEmrDb, null, 2));
        console.log(`Wiped EMR DB tables: ${Object.keys(newEmrDb).join(', ')}`);
    }

    // 4. Reset Pharmacy DB (Object with array keys)
    const pharmacyPath = path.join(DATA_DIR, files.pharmacy);
    if (fs.existsSync(pharmacyPath)) {
        const phDb = JSON.parse(fs.readFileSync(pharmacyPath, 'utf8'));
        const newPhDb: any = {};
        Object.keys(phDb).forEach(key => {
            newPhDb[key] = [];
        });
        fs.writeFileSync(pharmacyPath, JSON.stringify(newPhDb, null, 2));
        console.log(`Wiped Pharmacy DB tables: ${Object.keys(newPhDb).join(', ')}`);
    }

    console.log("------------------------------------------");
    console.log("GLOBAL DATA RESET COMPLETE.");
    console.log("Please restart the backend server to apply changes.");
    console.log("------------------------------------------");
}

resetData();
