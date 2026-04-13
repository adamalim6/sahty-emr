/**
 * Quick EVM simulation: process ORM from aller/, generate ORU to retour/
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseHprimMessage } from '../services/integrations/hprim/hprimParser';

const BASE_PATH = '/Users/adamalim/sahty_hprim';
const ALLER_PATH = path.join(BASE_PATH, 'aller');
const RETOUR_PATH = path.join(BASE_PATH, 'retour');
const PROCESSED_PATH = path.join(BASE_PATH, 'evm_processed');
const CRLF = '\r\n';

if (!fs.existsSync(PROCESSED_PATH)) fs.mkdirSync(PROCESSED_PATH, { recursive: true });

const files = fs.readdirSync(ALLER_PATH);
const hprFiles = files.filter(f => f.endsWith('.hpr'));
const okFiles = new Set(files.filter(f => f.endsWith('.ok')));
const readyFiles = hprFiles.filter(f => okFiles.has(f.replace(/\.hpr$/i, '.ok')));

console.log(`Ready files in aller/: ${readyFiles.length}`);

for (const hprFile of readyFiles) {
    const raw = fs.readFileSync(path.join(ALLER_PATH, hprFile), 'utf-8');
    const parsed = parseHprimMessage(raw);
    console.log(`\n📄 Processing: ${hprFile}`);
    console.log(`   Patient: ${parsed.patient.lastName} ${parsed.patient.firstName}`);

    const now = new Date().toISOString().replace(/[T\-:.Z]/g, '').slice(0, 14);
    const lines: string[] = [];

    // H segment
    lines.push(`H|\\^~|||EVM^Eurobio Middleware||||SAHTY^Sahty EMR||ORU||${now}|EVM-ORU-${Date.now()}`);

    // P segment
    const p = parsed.patient;
    lines.push(`P|1|${p.patientId}||${p.lastName}^${p.firstName}||${p.dateOfBirth}|${p.sex}||`);

    // OBR + OBX for each order
    for (let i = 0; i < parsed.orders.length; i++) {
        const obr = parsed.orders[i];
        lines.push(`OBR|${i + 1}|${obr.placerSampleId}^${obr.placerOrderId}||${obr.universalServiceId}^${obr.universalServiceText}|R|${now}|${obr.collectionDateTime || ''}|||||||`);

        // Fake OBX results
        const fakeResults = [
            { code: 'WBC', label: 'Leucocytes', value: '7.5', unit: 'G/L', ref: '4.0-10.0', flag: 'N' },
            { code: 'RBC', label: 'Globules rouges', value: '4.8', unit: 'T/L', ref: '4.0-5.5', flag: 'N' },
            { code: 'HGB', label: 'Hemoglobine', value: '14.2', unit: 'g/dL', ref: '12.0-16.0', flag: 'N' },
            { code: 'PLT', label: 'Plaquettes', value: '450', unit: 'G/L', ref: '150-400', flag: 'H' },
        ];

        fakeResults.forEach((r, j) => {
            lines.push(`OBX|${j + 1}|NM|${r.code}^${r.label}||${r.value}|${r.unit}|${r.ref}|${r.flag}|||F`);
        });
    }

    lines.push('L|1');
    const oruContent = lines.join(CRLF) + CRLF;

    // Write ORU to retour/
    const oruFile = hprFile.replace('ORM', 'ORU');
    fs.writeFileSync(path.join(RETOUR_PATH, oruFile), oruContent, 'utf-8');
    fs.writeFileSync(path.join(RETOUR_PATH, oruFile.replace(/\.hpr$/i, '.ok')), '', 'utf-8');
    console.log(`   ✅ ORU written: ${oruFile}`);

    // Move ORM to processed
    fs.renameSync(path.join(ALLER_PATH, hprFile), path.join(PROCESSED_PATH, hprFile));
    const okPath = path.join(ALLER_PATH, hprFile.replace(/\.hpr$/i, '.ok'));
    if (fs.existsSync(okPath)) {
        fs.renameSync(okPath, path.join(PROCESSED_PATH, hprFile.replace(/\.hpr$/i, '.ok')));
    }
}

console.log('\nFiles in retour/:', fs.readdirSync(RETOUR_PATH));
process.exit(0);
