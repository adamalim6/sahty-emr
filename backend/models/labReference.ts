export interface LabAnalyteContext {
    id: string;
    analyte_id: string;
    specimen_type_id: string;
    unit_id: string;
    method_id?: string;
    analyte_label: string;
    specimen_label: string;
    unit_label: string;
    method_label?: string;
    is_default: boolean;
    actif: boolean;
}

export interface LabActContext {
    id: string;
    global_act_id: string;
    analyte_context_id: string;
    sort_order: number | null;
    is_required: boolean;
    is_default: boolean;
    display_group?: string;
    actif: boolean;
}
