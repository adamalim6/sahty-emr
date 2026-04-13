/**
 * HPRIM Types
 * 
 * TypeScript interfaces for parsed HPRIM messages and DB records.
 */

// ── Direction & Status ──────────────────────────────────────────

export type HprimDirection = 'OUTBOUND' | 'INBOUND';
export type HprimMessageType = 'ORM' | 'ORU';
export type HprimMessageStatus = 'PENDING' | 'WRITTEN' | 'PROCESSED' | 'ERROR';

// ── Parsed HPRIM Structures ─────────────────────────────────────

export interface HprimSeparators {
    field: string;       // default: |
    component: string;   // default: ^
    escape: string;      // default: \
    repeat: string;      // default: ~
}

export interface HprimHeader {
    separators: HprimSeparators;
    senderName: string;
    senderFacility: string;
    receiverName: string;
    receiverFacility: string;
    messageDateTime: string;
    messageType: string; // 'ORM' | 'ORU'
    messageId: string;
    processingId: string;
    versionId: string;
}

export interface HprimPatient {
    patientId: string;      // IPP / LOCAL_MRN
    lastName: string;
    firstName: string;
    dateOfBirth: string;    // YYYYMMDD
    sex: string;            // M | F | U
    address?: string;
}

export interface HprimObr {
    setId: number;
    placerOrderId: string;   // Our HPRIM order ID
    placerSampleId: string;  // Our specimen barcode
    universalServiceId: string;   // External act code
    universalServiceText: string; // Act label
    requestedDateTime: string;
    collectionDateTime?: string;
    specimenType?: string;
    orderingProvider?: string;
    priority?: string;
    /** OBX results nested under this OBR (ORU only) */
    observations: HprimObx[];
}

export interface HprimObx {
    setId: number;
    valueType: string;       // NM, ST, CE, TX
    observationId: string;   // External analyte code
    observationText: string; // Analyte label
    observationValue: string;
    units: string;
    referenceRange: string;
    abnormalFlag: string;    // H, L, N, HH, LL
    resultStatus: string;   // F (final), P (preliminary), C (corrected)
}

export interface HprimMessage {
    header: HprimHeader;
    patient: HprimPatient;
    orders: HprimObr[];
    rawText: string;
}

// ── DB Record Interfaces ────────────────────────────────────────

export interface LabHprimMessage {
    id: string;
    direction: HprimDirection;
    message_type: HprimMessageType;
    file_name: string;
    file_path: string;
    ok_file_name: string | null;
    status: HprimMessageStatus;
    payload_text: string | null;
    error_message: string | null;
    retry_count: number;
    max_retries: number;
    next_retry_at: Date | null;
    created_at: Date;
    processed_at: Date | null;
}

export interface LabHprimLink {
    id: string;
    hprim_message_id: string;
    lab_request_id: string;
    lab_specimen_id: string | null;
    hprim_order_id: string;
    hprim_sample_id: string | null;
    consumed_at: Date | null;
    created_at: Date;
}
