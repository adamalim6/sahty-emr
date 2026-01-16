
export interface ATCNode {
    code: string;
    label_fr: string;
    label_en: string;
    level: number;
    parent: string | null;
    children: ATCNode[];
}
