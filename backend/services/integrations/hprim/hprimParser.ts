/**
 * HPRIM Parser
 * 
 * Parses inbound HPRIM ORU messages.
 * Separator-aware: reads separators from the H segment.
 * Tolerant of empty optional fields.
 * 
 * Supports: H, P, OBR, OBX, C, L segments
 */

import {
    HprimMessage,
    HprimHeader,
    HprimPatient,
    HprimObr,
    HprimObx,
    HprimSeparators,
} from './hprimTypes';

const DEFAULT_FIELD_SEP = '|';

/**
 * Safely get a field by index (0-based after segment ID)
 */
function getField(fields: string[], index: number): string {
    return (fields[index] ?? '').trim();
}

/**
 * Split a field into components
 */
function getComponents(field: string, compSep: string): string[] {
    return field.split(compSep);
}

/**
 * Parse the encoding characters from the H segment's second field.
 * Format: \^~ (escape, component, repeat)
 */
function parseSeparators(encodingField: string): HprimSeparators {
    return {
        field: DEFAULT_FIELD_SEP,
        escape: encodingField[0] || '\\',
        component: encodingField[1] || '^',
        repeat: encodingField[2] || '~',
    };
}

/**
 * Parse the H (Header) segment
 */
function parseH(fields: string[], sep: HprimSeparators): HprimHeader {
    const senderParts = getComponents(getField(fields, 4), sep.component);
    const receiverParts = getComponents(getField(fields, 8), sep.component);

    return {
        separators: sep,
        senderName: senderParts[0] || '',
        senderFacility: senderParts[1] || '',
        receiverName: receiverParts[0] || '',
        receiverFacility: receiverParts[1] || '',
        messageDateTime: getField(fields, 12),
        messageType: getField(fields, 10),
        messageId: getField(fields, 13),
        processingId: getField(fields, 11),
        versionId: '',
    };
}

/**
 * Parse the P (Patient) segment
 */
function parseP(fields: string[], sep: HprimSeparators): HprimPatient {
    const nameParts = getComponents(getField(fields, 4), sep.component);
    return {
        patientId: getField(fields, 2),
        lastName: nameParts[0] || '',
        firstName: nameParts[1] || '',
        dateOfBirth: getField(fields, 6),
        sex: getField(fields, 7) || 'U',
        address: getField(fields, 9),
    };
}

/**
 * Parse an OBR (Observation Request) segment
 */
function parseOBR(fields: string[], sep: HprimSeparators): HprimObr {
    const placerParts = getComponents(getField(fields, 2), sep.component);
    const serviceParts = getComponents(getField(fields, 4), sep.component);

    return {
        setId: parseInt(getField(fields, 1)) || 1,
        placerSampleId: placerParts[0] || '',
        placerOrderId: placerParts[1] || '',
        universalServiceId: serviceParts[0] || '',
        universalServiceText: serviceParts[1] || '',
        requestedDateTime: getField(fields, 6),
        collectionDateTime: getField(fields, 7),
        specimenType: getField(fields, 13),
        orderingProvider: getField(fields, 14),
        priority: getField(fields, 5),
        observations: [],
    };
}

/**
 * Parse an OBX (Observation/Result) segment
 */
function parseOBX(fields: string[], sep: HprimSeparators): HprimObx {
    const obIdParts = getComponents(getField(fields, 3), sep.component);

    return {
        setId: parseInt(getField(fields, 1)) || 1,
        valueType: getField(fields, 2),
        observationId: obIdParts[0] || '',
        observationText: obIdParts[1] || '',
        observationValue: getField(fields, 5),
        units: getField(fields, 6),
        referenceRange: getField(fields, 7),
        abnormalFlag: getField(fields, 8),
        resultStatus: getField(fields, 11) || 'F',
    };
}

/**
 * Parse a complete HPRIM message from raw text
 */
export function parseHprimMessage(rawText: string): HprimMessage {
    // Normalize line endings: support CRLF, CR, and LF
    const lines = rawText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter(l => l.trim().length > 0);

    if (lines.length === 0) {
        throw new Error('HPRIM: Empty message');
    }

    // First line must be H segment
    const firstLine = lines[0];
    if (!firstLine.startsWith('H')) {
        throw new Error(`HPRIM: Expected H segment, got: ${firstLine.substring(0, 20)}`);
    }

    // Parse separators from H segment
    // H|encoding|...|...
    // The field separator is always | (between H and encoding chars)
    const hFields = firstLine.split(DEFAULT_FIELD_SEP);
    const encodingChars = getField(hFields, 1);
    const sep = parseSeparators(encodingChars);

    const header = parseH(hFields, sep);

    let patient: HprimPatient | null = null;
    const orders: HprimObr[] = [];
    let currentObr: HprimObr | null = null;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const segType = line.split(sep.field)[0];
        const fields = line.split(sep.field);

        switch (segType) {
            case 'P':
                patient = parseP(fields, sep);
                break;

            case 'OBR':
                currentObr = parseOBR(fields, sep);
                orders.push(currentObr);
                break;

            case 'OBX':
                if (currentObr) {
                    currentObr.observations.push(parseOBX(fields, sep));
                }
                break;

            case 'C':
                // Comment segment — skip for now
                break;

            case 'L':
                // End of message
                break;

            default:
                // Unknown segment — log and skip
                console.warn(`[HPRIM Parser] Unknown segment type: ${segType}`);
                break;
        }
    }

    if (!patient) {
        throw new Error('HPRIM: No P (Patient) segment found');
    }

    return {
        header,
        patient,
        orders,
        rawText,
    };
}
