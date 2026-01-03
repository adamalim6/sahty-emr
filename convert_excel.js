
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Path to the Excel file in the OTHER workspace
const excelPath = '/Users/adamalim/Desktop/module-pharmacie-hospitalière/Référentiel  HUP du 11-07-2025 (2).xlsx';
const outputPath = path.resolve('./backend/data/actes.json');

console.log(`Reading file from: ${excelPath}`);

try {
    if (!fs.existsSync(excelPath)) {
        throw new Error('Excel file not found at path: ' + excelPath);
    }

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0]; // User said 1st sheet
    console.log(`Processing Sheet: ${sheetName}`);
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Extracted ${data.length} records.`);
    
    // writing to backend/data/actes.json
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${outputPath}`);
    
} catch (error) {
    console.error('Error processing Excel file:', error);
    process.exit(1);
}
