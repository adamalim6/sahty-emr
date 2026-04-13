/**
 * HPRIM Serializer
 * 
 * Builds outbound HPRIM ORM messages from internal data.
 * Uses correct HPRIM Santé segment naming: H, P, OBR, L
 * 
 * HPRIM Santé v2.x is ASTM-derived, NOT HL7.
 * Segments: H (header), P (patient), OBR (order), C (comment), L (end)
 */

import { HprimPatient, HprimObr, HprimSeparators } from './hprimTypes';

const DEFAULT_SEPARATORS: HprimSeparators = {
    field: '|',
    component: '^',
    escape: '\\',
    repeat: '~',
};

const CRLF = '\r\n';

/**
 * Pad or format a date as YYYYMMDD
 */
function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
}

/**
 * Format a date as YYYYMMDDHHMMSS
 */
function formatDateTime(d: Date): string {
    const date = formatDate(d);
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${date}${h}${min}${s}`;
}

/**
 * Build a field value, joining components with the component separator
 */
function comp(sep: HprimSeparators, ...parts: (string | undefined)[]): string {
    // Trim trailing empty components
    const cleaned = [...parts];
    while (cleaned.length > 0 && !cleaned[cleaned.length - 1]) {
        cleaned.pop();
    }
    return cleaned.map(p => p || '').join(sep.component);
}

/**
 * Build the H (Header) segment
 */
function buildH(sep: HprimSeparators, messageId: string, messageType: string): string {
    const now = formatDateTime(new Date());
    const fields = [
        'H',                                           // Segment ID
        `${sep.escape}${sep.component}${sep.repeat}`,  // Encoding characters
        '',                                             // Message Control ID
        '',                                             // Access Password
        comp(sep, 'SAHTY', 'Sahty EMR'),               // Sender
        '',                                             // Sender Address
        '',                                             // Reserved
        '',                                             // Reserved
        comp(sep, 'EVM', 'Eurobio Middleware'),         // Receiver
        '',                                             // Reserved
        messageType,                                    // Message type: ORM
        '',                                             // Reserved
        now,                                            // Date/Time of message
        messageId,                                      // Message ID
    ];
    return fields.join(sep.field);
}

/**
 * Build the P (Patient) segment
 */
function buildP(sep: HprimSeparators, patient: HprimPatient, seqNum: number): string {
    const fields = [
        'P',                                           // Segment ID
        String(seqNum),                                // Sequence Number
        patient.patientId,                             // Patient ID (IPP)
        '',                                            // Alt Patient ID
        comp(sep, patient.lastName, patient.firstName), // Patient Name
        '',                                            // Mother's Maiden Name
        patient.dateOfBirth || '',                     // Date of Birth
        patient.sex || 'U',                            // Sex
        '',                                            // Race
        patient.address || '',                         // Address
    ];
    return fields.join(sep.field);
}

/**
 * Build an OBR (Order/Observation Request) segment  
 */
function buildOBR(sep: HprimSeparators, obr: HprimObr): string {
    const fields = [
        'OBR',                                         // Segment ID
        String(obr.setId),                             // Set ID
        comp(sep, obr.placerSampleId, obr.placerOrderId), // Placer Order Number (sample^order)
        '',                                            // Filler Order Number (assigned by EVM)
        comp(sep, obr.universalServiceId, obr.universalServiceText), // Universal Service ID
        obr.priority || 'R',                           // Priority (R=routine, S=stat)
        obr.requestedDateTime || '',                   // Requested Date/Time
        obr.collectionDateTime || '',                  // Collection Date/Time
        '',                                            // Collection End Time
        '',                                            // Collection Volume
        '',                                            // Collector Identifier
        '',                                            // Action Code
        '',                                            // Danger Code
        obr.specimenType || '',                        // Specimen Source
        obr.orderingProvider || '',                    // Ordering Provider
    ];
    return fields.join(sep.field);
}

/**
 * Build the L (End) segment
 */
function buildL(sep: HprimSeparators): string {
    return ['L', '1'].join(sep.field);
}

/**
 * Serialize a complete HPRIM ORM message
 */
export function serializeOrm(
    messageId: string,
    patient: HprimPatient,
    orders: HprimObr[]
): string {
    const sep = DEFAULT_SEPARATORS;
    const lines: string[] = [];

    lines.push(buildH(sep, messageId, 'ORM'));
    lines.push(buildP(sep, patient, 1));

    for (const obr of orders) {
        lines.push(buildOBR(sep, obr));
    }

    lines.push(buildL(sep));

    // End with CRLF after every line, including last
    return lines.join(CRLF) + CRLF;
}
