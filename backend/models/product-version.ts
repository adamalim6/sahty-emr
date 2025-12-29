
export interface ProductVersion {
    id: string;
    productId: string;
    versionNumber: number;

    // Versioned parameters
    isSubdivisable: boolean;
    unitsPerPack: number;

    validFrom: Date;
    validTo?: Date; // If null, it is the current active version

    createdAt: Date;
    createdBy: string;
}
