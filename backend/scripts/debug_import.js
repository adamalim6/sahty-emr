const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../imports/medicaments.csv');
const DCI_PATH = path.join(__dirname, '../data/global/dci.json');

// Normalizer
const normalizeDciName = (str) => {
    if (!str) return '';
    return str
        .trim()
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
};

// 1. Load DCIs
const dcis = JSON.parse(fs.readFileSync(DCI_PATH, 'utf8'));
const dciMap = new Map();
dcis.forEach(d => {
    dciMap.set(normalizeDciName(d.name), d.id);
    if (d.synonyms) d.synonyms.forEach(s => dciMap.set(normalizeDciName(s), d.id));
});

console.log(`Loaded ${dcis.length} DCIs.`);
console.log('Check: IRBESARTAN ->', dciMap.get('IRBESARTAN'));
console.log('Check: HYDROCHLOROTHIAZIDE ->', dciMap.get('HYDROCHLOROTHIAZIDE'));

// 2. Read CSV and Find CO-IRVEL
const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
const lines = csvContent.split('\n');

const targetLine = lines.find(l => l.includes('CO-IRVEL') && l.includes('150 MG'));

if (!targetLine) {
    console.error('CO-IRVEL line not found!');
    process.exit(1);
}

console.log('\n--- TARGET LINE ---');
console.log(targetLine);
console.log('-------------------\n');

const cols = targetLine.split(';');
const nomComplet = cols[0];
const dosageStr = cols[2];
const dciStr = cols[5];

console.log('Nom:', nomComplet);
console.log('Raw DCI Column:', JSON.stringify(dciStr));
console.log('Raw Dosage Column:', JSON.stringify(dosageStr));

// Simulate Parsing
if (dciStr) {
    // Regex used in script: /\/\/|\+/
    const dciNames = dciStr.split(/\/\/|\+/).map(s => s.trim());
    // Regex used in script: /\/\/|\//
    const dosageParts = dosageStr ? dosageStr.split(/\/\/|\//).map(s => s.trim()) : [];

    console.log('Split DCIs:', dciNames);
    console.log('Split Dosages:', dosageParts);

    dciNames.forEach((name, idx) => {
        console.log(`\nProcessing DCI [${idx}]: "${name}"`);
        const normalized = normalizeDciName(name);
        console.log(`Normalized: "${normalized}"`);
        
        let dciId = dciMap.get(normalized);
        if (!dciId) {
             const cleaned = name.replace(/\(.*\)/, '');
             const normCleaned = normalizeDciName(cleaned);
             console.log(`Not found. Cleaning parens: "${cleaned}" -> "${normCleaned}"`);
             dciId = dciMap.get(normCleaned);
        }

        console.log(`Match ID: ${dciId}`);

        if (dciId) {
            const partDosage = dosageParts[idx] || '';
            console.log(`Dosage Part: "${partDosage}"`);
            
            const numberMatch = partDosage.match(/^([0-9.,]+)\s*([A-Za-z%µ]+)?/);
            if (numberMatch) {
                console.log(`Regex Match: Value="${numberMatch[1]}", Unit="${numberMatch[2]}"`);
                const val = parseFloat(numberMatch[1].replace(',', '.'));
                console.log(`Parsed Value: ${val}`);
            } else {
                console.log('FAILED Regex match for dosage number.');
            }
        }
    });
}
