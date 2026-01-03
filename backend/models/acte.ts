
export interface Acte {
    code: string; // Code SIH
    label: string; // Libellé SIH
    family: string; // Famille SIH
    subFamily: string; // Sous-famille SIH
    ngapCode: string; // Code NGAP correspondant
    ngapLabel: string; // Libellé NGAP correspondant
    ngapCoeff: string; // Cotation NGAP
    ccamCode: string; // Code CCAM correspondant
    ccamLabel: string; // Libellé CCAM correspondant
    ccamNature?: string; // Nature de la correspondance CCAM
    ngapNature?: string; // Nature de la correspondance NGAP
    type: string; // Type d'acte
    duration: number; // Durée moyenne en minutes
    active?: boolean; // Actif / Inactif (New field)
}
