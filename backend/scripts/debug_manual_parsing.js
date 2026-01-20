const fs = require('fs');
const path = require('path');

const csvContent = `NOM_COMPLET;PH\nAerrane;22,70\n"QuotedValue";"12,50"\nInteger;100`;
const csvPath = path.join(__dirname, 'test_manual.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');

console.log('--- Testing Manual Parsing Logic ---');

const fileContent = fs.readFileSync(csvPath, { encoding: 'utf8' });
const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);

// Parse Header
const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
console.log("Headers:", headers);

const idxName = headers.indexOf('NOM_COMPLET');
const idxPH = headers.indexOf('PH');

const parseFrenchNumber = (val) => {
    if (val === undefined || val === null) return undefined;
    const str = String(val).trim().replace(/"/g, ''); // Remove quotes
    if (!str) return undefined;
    
    // Remove thousand separators (space) and replace decimal comma with dot
    const clean = str.replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
};

// Iterate
for (let i = 1; i < lines.length; i++) {
    const rowRaw = lines[i];
    const cols = rowRaw.split(';');
    const getVal = (idx) => idx !== -1 && cols[idx] ? cols[idx].trim().replace(/"/g, '') : '';
    
    const name = getVal(idxName);
    const phRaw = cols[idxPH]; // Get raw col for debugging inputs
    const ph = parseFrenchNumber(phRaw); // Use raw input for parser
    
    console.log(`Row ${i}: Name="${name}", PH_Raw="${phRaw}", PH_Parsed=${ph} (Type: ${typeof ph})`);
}
