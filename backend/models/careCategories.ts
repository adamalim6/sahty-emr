export interface CareCategory {
    id: string;
    code: string;
    label: string;
    isActive: boolean;
    sortOrder: number;
    createdAt?: Date;
    updatedAt?: Date;
}
