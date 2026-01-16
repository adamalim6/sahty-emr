const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const CSV_PATH = path.join(__dirname, '../imports/medicaments.csv');
const DCI_PATH = path.join(__dirname, '../data/global/dci.json');

// Normalizer
const normalizeDciName = (str) => {
    if (!str) return '';
    return String(str)
        .trim()
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
};

// 1. Load DCIs
const dcis = JSON.parse(fs.readFileSync(DCI_PATH, 'utf8'));
const dciMap = new Map();
dcis.forEach(d => {
    dciMap.set(normalizeDciName(d.name), d.id);
});

console.log(`Loaded ${dcis.length} DCIs.`);
console.log('Check: ISOFLURANE ->', dciMap.get('ISOFLURANE'));

// 2. Read CSV
const workbook = xlsx.readFile(CSV_PATH, { type: 'file', codepage: 65001, raw: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = xlsx.utils.sheet_to_json(sheet, { defval: "" });

const aerrane = rawData.find(r => r['NOM_COMPLET'] && r['NOM_COMPLET'].includes('AERRANE'));

if (!aerrane) {
    console.error('AERRANE not found!');
} else {
    console.log('--- AERRANE ROW ---');
    console.log(JSON.stringify(aerrane, null, 2));
    
    const dciStr = aerrane['DCI'];
    const dosageStr = aerrane['DOSAGE'];
    
    console.log(`DCI Raw: "${dciStr}"`);
    console.log(`Dosage Raw: "${dosageStr}"`);
    
    const dciNames = String(dciStr).split(/\/\/|\+|\n/).map(s => s.trim()).filter(s => s);
    const dosageParts = dosageStr ? String(dosageStr).split(/\/\/|\/|\n/).map(s => s.trim()).filter(s => s) : [];
    
    dciNames.forEach((name, idx) => {
        let dciId = dciMap.get(normalizeDciName(name));
        console.log(`Processing "${name}" (Computed ID: ${dciId})`);
        
        const partDosage = dosageParts[idx] || '';
        console.log(`Dosage Part: "${partDosage}"`);
        
        const numberMatch = partDosage.match(/^([0-9.,]+)\s*([A-Za-z%µ]+)?/);
        if (numberMatch) {
             console.log(`Dosage Matched: ${numberMatch[1]} ${numberMatch[2]}`);
        } else {
             console.log(`Dosage parsing FAILED for "${partDosage}". In current logic, this DCI would be SKIPPED.`);
        }
    });
}
