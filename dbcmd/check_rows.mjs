import fs from 'fs';
import path from 'path';

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;
    
    let row = {};
    let currentVal = '';
    let inQuotes = false;
    let colIdx = 0;
    
    for (let j = 0; j < rawLine.length; j++) {
      const char = rawLine[j];
      
      if (char === '"' && (j === 0 || rawLine[j-1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        if (colIdx < headers.length) {
            row[headers[colIdx]] = currentVal.trim();
        }
        currentVal = '';
        colIdx++;
      } else {
        currentVal += char;
      }
    }
    if (colIdx < headers.length) {
      row[headers[colIdx]] = currentVal.trim();
    }
    rows.push(row);
  }
  return rows;
}

const csvPath = '/Users/adamalim/Desktop/biology_global_actes_to_lab_sub_sections_mapping_curated_round3.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const rows = parseCSV(content);
console.log('Total data rows:', rows.length);

const valid = rows.filter(m => m.id && m.id !== 'NULL' && m.id !== '' && m.mapped_lab_section_code);
console.log('Valid rows:', valid.length);

const missingIds = rows.filter(m => !m.id || m.id === 'NULL' || m.id === '');
console.log('Missing IDs:', missingIds.length);

const missingSection = rows.filter(m => m.id && m.id !== 'NULL' && m.id !== '' && !m.mapped_lab_section_code);
console.log('Missing mapped_lab_section_code:', missingSection.length);

const nullSection = rows.filter(m => m.id && m.id !== 'NULL' && m.id !== '' && (m.mapped_lab_section_code === 'NULL' || m.mapped_lab_section_code?.toLowerCase() === 'null'));
console.log('mapped_lab_section_code is exactly "NULL":', nullSection.length);

