import { GlobalStore } from '../utils/tenantStore';
import { User } from '../models/auth';
import bcrypt from 'bcryptjs';

const ADMINS_FILE = 'admins';

interface GlobalAdminData {
    admins: User[];
}

const DEFAULT_DATA: GlobalAdminData = {
    admins: []
};

export class GlobalAdminService {
    private static instance: GlobalAdminService;

    public static getInstance(): GlobalAdminService {
        if (!GlobalAdminService.instance) {
            GlobalAdminService.instance = new GlobalAdminService();
        }
        return GlobalAdminService.instance;
    }

    private loadData(): GlobalAdminData {
        // We might want to store just an array, but keeping object structure for extensibility
        // Initially, let's just store the array directly if that's what GlobalStore expects for 'admins'?
        // The previous pattern for patients was array. Let's check GlobalStore usage.
        // GlobalStore.load('patients', []) -> returns Patient[]
        // So for 'admins', let's store User[] directly.
        return { admins: GlobalStore.load<User[]>('admins', []) };
    }

    private saveData(data: GlobalAdminData) {
        GlobalStore.save('admins', data.admins);
    }

    public async authenticate(username: string, password: string): Promise<User | null> {
        const data = this.loadData();
        const admin = data.admins.find(u => u.username === username && u.active);
        
        if (!admin) return null;

        const isValid = await bcrypt.compare(password, admin.password_hash);
        if (!isValid) return null;

        return admin;
    }

    public async createGlobalAdmin(adminUser: User): Promise<User> {
        const data = this.loadData();
        
        if (data.admins.find(u => u.username === adminUser.username)) {
            throw new Error("Username already exists in Global Realm");
        }

        // Enforce SUPER_ADMIN role consistency
        // Ideally we overwrite it to ensure it is correct
        // But relying on caller to provide correct object structure for now
        
        data.admins.push(adminUser);
        this.saveData(data);
        return adminUser;
    }
    
    public getAdminById(id: string): User | undefined {
        const data = this.loadData();
        return data.admins.find(u => u.id === id);
    }
}

export const globalAdminService = GlobalAdminService.getInstance();
