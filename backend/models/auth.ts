
export enum UserType {
    PUBLISHER_SUPERADMIN = 'PUBLISHER_SUPERADMIN',
    SUPER_ADMIN = 'SUPER_ADMIN', // Added for Global Realm
    TENANT_SUPERADMIN = 'TENANT_SUPERADMIN',
    TENANT_USER = 'TENANT_USER'
}

export interface User {
    id: string;
    username: string;
    password_hash: string;
    nom: string;
    prenom: string;
    user_type: UserType;
    role_id: string;
    role_code?: string; // Added for safety checks
    client_id: string | null; // Null for Publisher
    INPE?: string;
    active?: boolean;
    permissions?: string[];
    modules?: string[]; // Added for Unified Routing
    service_ids?: string[];
}

export interface Client {
    id: string;
    type: 'HOPITAL' | 'CLINIQUE' | 'CABINET';
    designation: string;
    siege_social: string;
    representant_legal: string;
}

export interface Role {
    id: string;
    name: string;
    code: string;
}
