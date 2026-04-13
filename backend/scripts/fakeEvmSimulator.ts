/**
 * Fake EVM Simulator
 * 
 * Watches the aller/ folder for ORM files.
 * For each ORM, generates a fake ORU with realistic results.
 * Writes ORU to retour/ folder.
 * 
 * Usage: npx ts-node --transpile-only scripts/fakeEvmSimulator.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseHprimMessage } from '../services/integrations/hprim/hprimParser';
import { HprimObr, HprimObx } from '../services/integrations/hprim/hprimTypes';

const BASE_PATH = process.env.HPRIM_BASE_PATH || '/Users/adamalim/sahty_hprim';
const ALLER_PATH = path.join(BASE_PATH, 'aller');
const RETOUR_PATH = path.join(BASE_PATH, 'retour');
const PROCESSED_PATH = path.join(BASE_PATH, 'evm_processed');

const CRLF = '\r\n';

// ── Fake Result Generation ──────────────────────────────────────

interface FakeAnalyte {
    code: string;
    label: string;
    valueType: string;
    range: [number, number];
    unit: string;
    refRange: string;
}

/** Predefined analyte templates per common act code */
const ANALYTE_TEMPLATES: Record<string, FakeAnalyte[]> = {
    'NFSC': [
        { code: 'WBC', label: 'Leucocytes', valueType: 'NM', range: [4.0, 11.0], unit: 'G/L', refRange: '4.0-10.0' },
        { code: 'RBC', label: 'Globules rouges', valueType: 'NM', range: [3.5, 6.0], unit: 'T/L', refRange: '4.0-5.5' },
        { code: 'HGB', label: 'Hémoglobine', valueType: 'NM', range: [10.0, 18.0], unit: 'g/dL', refRange: '12.0-16.0' },
        { code: 'HCT', label: 'Hématocrite', valueType: 'NM', range: [30, 55], unit: '%', refRange: '36-46' },
        { code: 'PLT', label: 'Plaquettes', valueType: 'NM', range: [100, 400], unit: 'G/L', refRange: '150-400' },
    ],
    '17H': [
        { code: '17OH', label: '17-OH Progestérone', valueType: 'NM', range: [0.5, 5.0], unit: 'ng/mL', refRange: '0.2-3.3' },
    ],
    'DEFAULT': [
        { code: 'RES1', label: 'Résultat 1', valueType: 'NM', range: [1.0, 100.0], unit: 'U/L', refRange: '10-50' },
        { code: 'RES2', label: 'Résultat 2', valueType: 'NM', range: [0.1, 10.0], unit: 'mg/L', refRange: '0.5-5.0' },
        { code: 'RES3', label: 'Résultat 3', valueType: 'NM', range: [50, 200], unit: 'mmol/L', refRange: '70-110' },
    ],
};

/** Known act codes mapped to template names */
const ACT_TEMPLATE_MAP: Record<string, string> = {
    'NFSC': 'NFSC',
    'NFS': 'NFSC',
    '17H': '17H',
};

function getTemplatesForAct(actCode: string): FakeAnalyte[] {
    const templateKey = ACT_TEMPLATE_MAP[actCode] || 'DEFAULT';
    return ANALYTE_TEMPLATES[templateKey] || ANALYTE_TEMPLATES['DEFAULT'];
}

function randomInRange(min: number, max: number): number {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function getAbnormalFlag(value: number, refRange: string): string {
    const match = refRange.match(/^([\d.]+)[-–]([\d.]+)$/);
    if (!match) return 'N';
    const low = parseFloat(match[1]);
    const high = parseFloat(match[2]);
    if (value < low) return 'L';
    if (value > high) return 'H';
    return 'N';
}

// ── HPRIM ORU Builder ───────────────────────────────────────────

function formatDateTime(d: Date): string {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}${mo}${da}${h}${mi}${s}`;
}

function buildOruMessage(
    ormParsed: ReturnType<typeof parseHprimMessage>,
    fakeResults: Map<string, { obx: HprimObx[]; obr: HprimObr }>
): string {
    const now = formatDateTime(new Date());
    const sep = '|';
    const comp = '^';
    const lines: string[] = [];

    // H segment
    lines.push(`H|\\${comp}~|||EVM${comp}Eurobio Middleware|||${comp}|||SAHTY${comp}Sahty EMR|||ORU|||${now}|EVM-ORU-${Date.now()}`);

    // P segment
    const p = ormParsed.patient;
    lines.push(`P|1|${p.patientId}||${p.lastName}${comp}${p.firstName}||${p.dateOfBirth}|${p.sex}||`);

    // OBR + OBX segments
    let obrIndex = 0;
    for (const [orderId, data] of fakeResults.entries()) {
        obrIndex++;
        const obr = data.obr;
        lines.push(`OBR|${obrIndex}|${obr.placerSampleId}${comp}${orderId}||${obr.universalServiceId}${comp}${obr.universalServiceText}|R|${now}|${obr.collectionDateTime || ''}|||||||`);

        for (let j = 0; j < data.obx.length; j++) {
            const obx = data.obx[j];
            lines.push(`OBX|${j + 1}|${obx.valueType}|${obx.observationId}${comp}${obx.observationText}||${obx.observationValue}|${obx.units}|${obx.referenceRange}|${obx.abnormalFlag}|||F`);
        }
    }

    // L segment
    lines.push('L|1');

    return lines.join(CRLF) + CRLF;
}

// ── Main Loop ───────────────────────────────────────────────────

function ensureDirs() {
    for (const dir of [ALLER_PATH, RETOUR_PATH, PROCESSED_PATH]) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

function processOrmFile(hprFile: string): void {
    const hprPath = path.join(ALLER_PATH, hprFile);
    const okPath = path.join(ALLER_PATH, hprFile.replace(/\.hpr$/i, '.ok'));

    const raw = fs.readFileSync(hprPath, 'utf-8');
    console.log(`\n📄 Processing: ${hprFile}`);

    try {
        const parsed = parseHprimMessage(raw);
        console.log(`   Patient: ${parsed.patient.lastName} ${parsed.patient.firstName} (IPP: ${parsed.patient.patientId})`);
        console.log(`   Orders: ${parsed.orders.length} OBR(s)`);

        // Generate fake results for each OBR
        const fakeResults = new Map<string, { obx: HprimObx[]; obr: HprimObr }>();

        for (const obr of parsed.orders) {
            const actCode = obr.universalServiceId;
            const templates = getTemplatesForAct(actCode);

            const observations: HprimObx[] = templates.map((t, i) => {
                const value = randomInRange(t.range[0], t.range[1]);
                const flag = getAbnormalFlag(value, t.refRange);
                return {
                    setId: i + 1,
                    valueType: t.valueType,
                    observationId: t.code,
                    observationText: t.label,
                    observationValue: String(value),
                    units: t.unit,
                    referenceRange: t.refRange,
                    abnormalFlag: flag,
                    resultStatus: 'F',
                };
            });

            fakeResults.set(obr.placerOrderId, { obx: observations, obr });
            console.log(`   → ${actCode}: ${observations.length} analyte(s) generated`);
        }

        // Build ORU
        const oruContent = buildOruMessage(parsed, fakeResults);

        // Write to retour/
        const oruFilename = hprFile.replace('ORM', 'ORU');
        const oruPath = path.join(RETOUR_PATH, oruFilename);
        const oruOkPath = path.join(RETOUR_PATH, oruFilename.replace(/\.hpr$/i, '.ok'));

        fs.writeFileSync(oruPath, oruContent, 'utf-8');
        fs.writeFileSync(oruOkPath, '', 'utf-8');

        console.log(`   ✅ ORU written: ${oruFilename}`);

        // Archive the processed ORM
        const ts = Date.now();
        fs.renameSync(hprPath, path.join(PROCESSED_PATH, `${ts}_${hprFile}`));
        if (fs.existsSync(okPath)) {
            fs.renameSync(okPath, path.join(PROCESSED_PATH, `${ts}_${hprFile.replace(/\.hpr$/i, '.ok')}`));
        }

    } catch (err: any) {
        console.error(`   ❌ Failed: ${err.message}`);
    }
}

function runOnce(): void {
    const files = fs.readdirSync(ALLER_PATH);
    const hprFiles = files.filter(f => f.endsWith('.hpr'));
    const okFiles = new Set(files.filter(f => f.endsWith('.ok')));

    // Only process .hpr files that have a matching .ok
    const readyFiles = hprFiles.filter(f => okFiles.has(f.replace(/\.hpr$/i, '.ok')));

    if (readyFiles.length === 0) {
        return;
    }

    console.log(`\n🔬 EVM Simulator: Found ${readyFiles.length} ORM file(s)`);

    for (const file of readyFiles) {
        processOrmFile(file);
    }
}

// ── Entry Point ─────────────────────────────────────────────────

console.log('🧪 Fake EVM Simulator Started');
console.log(`   Watching: ${ALLER_PATH}`);
console.log(`   Output:   ${RETOUR_PATH}`);
console.log('   Press Ctrl+C to stop\n');

ensureDirs();

// Run once immediately
runOnce();

// Then poll every 3 seconds
const interval = setInterval(runOnce, 3000);

process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n🛑 EVM Simulator stopped.');
    process.exit(0);
});
