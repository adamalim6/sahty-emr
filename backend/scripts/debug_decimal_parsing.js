const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const csvContent = `NOM;PH\nAerrane;22,70\nOther;12.50\nInteger;100`;
const csvPath = path.join(__dirname, 'test_decimal.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');

console.log('--- Testing Current Logic ---');

const workbook = xlsx.read(fs.readFileSync(csvPath), { type: 'buffer' }); // Default read
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = xlsx.utils.sheet_to_json(sheet, { defval: "" });

const parseFrenchNumber = (val) => {
    console.log(`[Parse] Input: "${val}" (Type: ${typeof val})`);
    if (val === undefined || val === null) return undefined;
    const str = String(val); 
    const clean = str.replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(clean);
    console.log(`[Parse] Output: ${num}`);
    return isNaN(num) ? undefined : num;
};

rawData.forEach(row => {
    console.log(`Row: ${JSON.stringify(row)}`);
    // Simulate script logic
    const ph = parseFrenchNumber(row['PH']);
    console.log(`Parsed PH for ${row.NOM}: ${ph}`);
});

console.log('\n--- Testing RAW:TRUE Logic ---');
// Test with raw: true
const rawDataTrue = xlsx.utils.sheet_to_json(sheet, { raw: true, defval: "" }); // raw: true keeps values as is?
rawDataTrue.forEach(row => {
    console.log(`Row (raw=true): ${JSON.stringify(row)}`);
});
