
export enum UserType {
    PUBLISHER_SUPERADMIN = 'PUBLISHER_SUPERADMIN',
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
    client_id: string | null; // Null for Publisher
    INPE?: string;
    active?: boolean;
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
