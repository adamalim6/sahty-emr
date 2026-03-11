export interface ReferenceUnit {
    id: string;
    code: string;
    display: string;
    isUcum: boolean;
    isActive: boolean;
    requiresFluidInfo?: boolean;
    sortOrder: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface ReferenceRoute {
    id: string;
    code: string;
    label: string;
    isActive: boolean;
    requiresFluidInfo?: boolean;
    sortOrder: number;
    createdAt?: string;
    updatedAt?: string;
}
