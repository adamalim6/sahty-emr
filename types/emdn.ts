export interface EMDNNode {
    code: string;
    label_fr: string;
    label_en: string;
    level: number;
    parentCode: string | null;
    children: EMDNNode[];
}
