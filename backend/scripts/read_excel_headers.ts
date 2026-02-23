import * as xlsx from 'xlsx';
import * as path from 'path';

const filePath = '/Users/adamalim/Desktop/medicaments_data.xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false });
console.log("Headers:", data[0]);
console.log("Row 1:", data[1]);
console.log("Row 2:", data[2]);
console.log("Row 3:", data[3]);
