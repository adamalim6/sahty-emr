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
        row[headers[colIdx]] = currentVal.trim();
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

function escapeSQL(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  if (val.toLowerCase() === 'true') return 'TRUE';
  if (val.toLowerCase() === 'false') return 'FALSE';
  return "'" + val.replace(/'/g, "''") + "'";
}

const desk = '/Users/adamalim/Desktop';

let sql = 'BEGIN;\n\n';

// 1. Units
const unitsContent = fs.readFileSync(path.join(desk, 'lims_units_missing.csv'), 'utf8');
const units = parseCSV(unitsContent);
sql += '-- Seed public.units\n';
sql += 'INSERT INTO public.units (code, display, is_ucum, is_active, sort_order, requires_fluid_info) VALUES \n';
const unitVals = units.map(u => `(${escapeSQL(u.code)}, ${escapeSQL(u.display)}, ${escapeSQL(u.is_ucum)}::boolean, ${escapeSQL(u.is_active)}::boolean, ${escapeSQL(u.sort_order)}::int, ${escapeSQL(u.requires_fluid_info)}::boolean)`);
sql += unitVals.join(',\n') + ';\n\n';

// 2. Sections
const sectionsContent = fs.readFileSync(path.join(desk, 'lab_sections_seed_exhaustive.csv'), 'utf8');
const sectionsRaw = parseCSV(sectionsContent);
const distinctSections = new Map();
sectionsRaw.forEach(s => distinctSections.set(`${s.sous_famille_code}_${s.code}`, s));
const sections = Array.from(distinctSections.values());

sql += '-- Seed public.lab_sections\n';
sql += 'INSERT INTO public.lab_sections (sous_famille_id, code, libelle, description, actif, sort_order) \n';
const sectionSelects = sections.map(s => `  SELECT id, ${escapeSQL(s.code)}, ${escapeSQL(s.libelle)}, ${escapeSQL(s.description)}, ${escapeSQL(s.actif)}::boolean, ${escapeSQL(s.sort_order)}::int \n  FROM public.sih_sous_familles \n  WHERE code = ${escapeSQL(s.sous_famille_code)} \n  AND NOT EXISTS (SELECT 1 FROM public.lab_sections WHERE code = ${escapeSQL(s.code)} AND sous_famille_id = public.sih_sous_familles.id)`);
sql += sectionSelects.join('\n  UNION ALL\n') + ';\n\n';

// 3. Sub-sections
const subSectionsContent = fs.readFileSync(path.join(desk, 'lab_sub_sections_seed_exhaustive.csv'), 'utf8');
const subSectionsRaw = parseCSV(subSectionsContent);
const distinctSubSecs = new Map();
subSectionsRaw.forEach(s => distinctSubSecs.set(`${s.section_code}_${s.code}`, s));
const subSections = Array.from(distinctSubSecs.values());

sql += '-- Seed public.lab_sub_sections\n';
sql += 'INSERT INTO public.lab_sub_sections (section_id, code, libelle, description, actif, sort_order) \n';
const subVals = subSections.map(s => `  SELECT id, ${escapeSQL(s.code)}, ${escapeSQL(s.libelle)}, ${escapeSQL(s.description)}, ${escapeSQL(s.actif)}::boolean, ${escapeSQL(s.sort_order)}::int \n  FROM public.lab_sections \n  WHERE code = ${escapeSQL(s.section_code)} \n  AND NOT EXISTS (SELECT 1 FROM public.lab_sub_sections WHERE code = ${escapeSQL(s.code)} AND section_id = public.lab_sections.id)`);
sql += subVals.join('\n  UNION ALL\n') + ';\n\n';

// 4. Update global_acts using mapped values
const mappingContent = fs.readFileSync(path.join(desk, 'biology_global_actes_to_lab_sub_sections_mapping_curated_round3.csv'), 'utf8');
const mappings = parseCSV(mappingContent);

sql += '-- Update public.global_actes with section and sub-section linking\n';
sql += 'UPDATE public.global_actes g\n';
sql += 'SET lab_section_id = sec.id, \n    lab_sub_section_id = subsec.id\n';
sql += 'FROM (\n  VALUES \n';
const validMappings = mappings.filter(m => m.id && m.id !== 'NULL' && m.id !== '' && m.mapped_lab_section_code);
const mapVals = validMappings.map(m => `  ('${m.id}'::uuid, ${escapeSQL(m.mapped_lab_section_code)}, ${escapeSQL(m.mapped_lab_sub_section_code)})`);
sql += mapVals.join(',\n') + '\n) AS updates(id, sec_code, subsec_code)\n';
sql += 'LEFT JOIN public.lab_sections sec ON sec.code = updates.sec_code\n';
sql += 'LEFT JOIN public.lab_sub_sections subsec ON subsec.code = updates.subsec_code\n';
sql += 'WHERE g.id = updates.id;\n\n';

sql += 'COMMIT;\n';

fs.writeFileSync('seed_lab_reference_data.sql', sql);
console.log('Successfully created seed_lab_reference_data.sql');
