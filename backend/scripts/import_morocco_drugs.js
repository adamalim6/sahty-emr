const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const xlsx = require('xlsx');

// Paths
const CSV_PATH = path.join(__dirname, '../imports/medicaments.csv');
const DCI_PATH = path.join(__dirname, '../data/global/dci.json');
const PRODUCTS_PATH = path.join(__dirname, '../data/global/products.json');

// Helper to generate IDs
const generateId = () => crypto.randomUUID();
// Helper for Sahty Code (Sequential-ish random)
const generateSahtyCode = () => 'SAH-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

// Helper to parse numbers (French format 1 234,56 -> 1234.56)
const parseFrenchNumber = (val) => {
    if (val === undefined || val === null) return undefined;
    const str = String(val); // Ensure string
    const clean = str.replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
};

// Helper to normalize DCI names (remove accents, etc.)
const normalizeDciName = (str) => {
    if (!str) return '';
    return String(str)
        .trim()
        .toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
};

// Start
console.log('Starting Import of Moroccan Medications (via XLSX)...');

// 1. Load DCIs for Matching
let dcis = [];
try {
    const dciData = fs.readFileSync(DCI_PATH, 'utf8');
    dcis = JSON.parse(dciData);
    console.log(`Loaded ${dcis.length} DCIs.`);
} catch (e) {
    console.warn('Could not load DCI file, skipping DCI linking.', e.message);
}

// Create Map for fast lookup
const dciMap = new Map();
dcis.forEach(d => {
    if (d.name) dciMap.set(normalizeDciName(d.name), d.id);
    if (d.synonyms) d.synonyms.forEach(s => dciMap.set(normalizeDciName(s), d.id));
});

// 2. Read CSV with XLSX
try {
    console.log('Reading CSV file with XLSX...');
    const workbook = xlsx.readFile(CSV_PATH, { type: 'file', codepage: 65001, raw: false }); // raw: false ensures everything is string-ish
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    // CSV headers: NOM_COMPLET;Nom commercial;DOSAGE;FORME;PRESENTATION;DCI;FABRIQUANT;PPV;PH;PFHT;UNITES_PAR_BOITE
    // Sheet to JSON uses first row as keys usually
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: "" }); // defval maps empty cells to ""
    
    console.log(`Total Rows in Sheet: ${rawData.length}`);

    const existingProductsStr = fs.existsSync(PRODUCTS_PATH) ? fs.readFileSync(PRODUCTS_PATH, 'utf8') : '[]';
    let existingProducts = [];
    try {
       const allProducts = JSON.parse(existingProductsStr);
       // Filter out likely previous imports to avoid duplication
       existingProducts = allProducts.filter(p => !p.marketInfo && !p.form); 
       console.log(`Filtered existing products. Keeping ${existingProducts.length} items.`);
    } catch (e) {
       console.warn("Could not parse existing products, starting fresh.");
       existingProducts = [];
    }

    const newProducts = [];
    let matchCount = 0;

    // Iterate Rows
    for (const row of rawData) {
        // Map Keys (keys might be slightly different depending on header row parsing)
        // We assume headers are: NOM_COMPLET, DOSAGE, FORME, PRESENTATION, DCI, FABRIQUANT, PPV, PH, PFHT, UNITES_PAR_BOITE
        // Use bracket notation to be safe against spaces or weird chars if headers have them
        
        // Debug first row keys if needed
        if (newProducts.length === 0 && matchCount === 0) {
             console.log("First Row Keys:", Object.keys(row));
        }

        const nomComplet = row['NOM_COMPLET'];
        if (!nomComplet) continue; // Skip empty rows

        const nomCommercial = row['Nom commercial'];
        const dosageStr = row['DOSAGE'];
        const forme = row['FORME'];
        const presentation = row['PRESENTATION'];
        const dciStr = row['DCI'];
        const fabriquant = row['FABRIQUANT'];
        const ppv = parseFrenchNumber(row['PPV']);
        const ph = parseFrenchNumber(row['PH']);
        const pfht = parseFrenchNumber(row['PFHT']);
        const unitsPerBoxStr = row['UNITES_PAR_BOITE'];

        // Parse DCI Composition
        let dciComposition = [];
        if (dciStr) {
            // Valid delimiters: //, +, or newline
            // Sometimes excel puts newline for //
            const dciNames = String(dciStr).split(/\/\/|\+|\n/).map(s => s.trim()).filter(s => s);
            const dosageStrClean = dosageStr ? String(dosageStr).trim() : '';
            
            let dosageParts = [];

            if (nomComplet && nomComplet.includes('CUSIMOLOL')) {
                console.log(`DEBUG: CUSIMOLOL RAW DOSAGE='${dosageStr}'`);
            }

            // COMPLEX DOSAGE LOGIC
            // Case 1: "2 MG / ML + 5 MG / ML" -> Split by '+'
            if (dosageStrClean.includes('+')) {
                 dosageParts = dosageStrClean.split('+').map(s => s.trim());
            } 
            // Case 2: "500 MG / 50 MG" -> Split by '/' (Standard)
            // BUT be careful about "2 MG / ML" (Simpler term) -> This is ONE part.
            // Heuristic: If we split by '/' and get more parts than DCIs, and parts contain units like ML/dL/etc, it might be a single complex unit.
            // Ideally, we align with DCI count.
            else if (dosageStrClean.indexOf('/') !== -1) {
                 // Check if '/' is used as separator or as unit part (mg/ml)
                 // E.g. "500 MG / 50 MG" (2 parts) vs "20 MG/ML" (1 part)
                 // If we have 2 DCIs, we expect 2 parts.
                 
                 // Try splitting by '/'
                 const slashParts = dosageStrClean.split('/').map(s => s.trim());
                 
                 // If we have 2 DCIs and 2 slashParts -> "500 MG" and "50 MG" -> Matches Case 2.
                 if (dciNames.length === slashParts.length && dciNames.length > 1) {
                      dosageParts = slashParts;
                 } 
                 // If we have 1 DCI and 1 slashPart? "20 MG" -> OK.
                 // If we have 1 DCI and "20 MG/ML"? -> Slash is part of unit.
                 else {
                      // Fallback: If split count mismatches DCI count, treat as single string? 
                      // Or regex split?
                      // The user said: "separated by /" for simple terms.
                      // Let's assume proper delimiters.
                      
                      // For now, if we fail to pinpoint, we fallback to regex extraction or raw string assignment (though data model needs strict structure).
                      // Let's rely on mapping index.
                      
                      // If mismatch, try to keep it as one (e.g. 20 mg/ml) or split if valid.
                      if (dciNames.length > 1 && slashParts.length > dciNames.length) {
                           // Ambiguous. "5 mg/ml / 2 mg/ml" -> 3 slashes.
                           // User didn't specify this sub-case for '/' separator, but implied 'separated by /' for simple mass.
                           // For 'mass to volume dependent' (mg/ml), they are separated by '+'.
                           
                           // So if we are here (no '+'), and we have multiple DCIs, and slashes:
                           // It's likely "Mass / Mass".
                           dosageParts = slashParts;
                      } else {
                          // Default split by / for multiple components if no + found
                          if (dciNames.length > 1) {
                              dosageParts = slashParts;
                          } else {
                              // Single DCI, Single dosage string
                               dosageParts = [dosageStrClean];
                          }
                      }
                 }
            } else {
                // No separator, single part or empty
                dosageParts = [dosageStrClean];
            }

            dciNames.forEach((name, idx) => {
                let dciId = dciMap.get(normalizeDciName(name));
                
                if (!dciId) {
                    const cleaned = name.replace(/\(.*\)/, '');
                    dciId = dciMap.get(normalizeDciName(cleaned));
                }

                if (dciId) {
                    matchCount++;
                    let partDosage = dosageParts[idx] || '';
                    if (dciNames.length === 1 && dosageParts.length > 1) {
                         // Case: 1 DCI but dosage string has slash "20 MG/ML" -> Logic above might have split it.
                         // Rejoin if it was over-split?
                         // Actually, for 1 DCI, we took the whole string.
                         partDosage = dosageStrClean;
                    }
                    
                    let dosageVal = undefined;
                    let unitVal = undefined;

                    // Remove aggressive integer-only check
                    // Generic Regex
                    // allow units with / like mg/ml, or just mg
                    const numberMatch = partDosage.match(/^([0-9.,]+)\s*([A-Za-z%µ\/²³]+)?/);
                    if (numberMatch) {
                        dosageVal = parseFloat(numberMatch[1].replace(',', '.'));
                        let unitRaw = numberMatch[2] ? numberMatch[2].trim() : ''; 
                        
                        // Normalization of Unit
                        if (!unitRaw) {
                            // Heuristic: Small unitless decimal implies percentage (e.g. 0.05 -> 5%)
                            // Also handle exact "1" for AERRANE (100%)
                            if (dosageVal <= 1) { 
                                    dosageVal = dosageVal * 100;
                                    unitVal = '%';
                            } else {
                                // Value > 1 with no unit. e.g. "500". Default to mg?
                                // "5" for CUSIMOLOL -> 5 mg? Better than 500%.
                                unitVal = 'mg'; 
                            }
                        } else {
                                // Map to known enum
                                const u = unitRaw.toUpperCase();
                                if (u === 'MG') unitVal = 'mg';
                                else if (u === 'G') unitVal = 'g';
                                else if (u === 'KG') unitVal = 'kg';
                                else if (u === 'ML') unitVal = 'ml';
                                else if (u === 'MCG' || u === 'µG' || u === 'UG') unitVal = 'mcg';
                                else if (u === 'NG') unitVal = 'ng';
                                
                                else if (u === 'UI' || u === 'IU') unitVal = 'IU';
                                else if (u === 'MIU') unitVal = 'mIU';
                                else if (u === 'KIU') unitVal = 'kIU';
                                else if (u === 'U') unitVal = 'U';
                                else if (u === 'MU') unitVal = 'mU';
                                else if (u === 'KU') unitVal = 'kU';
                                
                                else if (u === '%') unitVal = '%';
                                
                                // Complex Units
                                else if (u === 'MG/ML') unitVal = 'mg/mL';
                                else if (u === 'MCG/ML' || u === 'µG/ML') unitVal = 'mcg/mL';
                                else if (u === 'NG/ML') unitVal = 'ng/mL'; // Supported?
                                else if (u === 'IU/ML' || u === 'UI/ML') unitVal = 'IU/mL';
                                else if (u === 'U/ML') unitVal = 'U/mL';
                                else if (u === 'G/L') unitVal = 'g/L';
                                else if (u === 'MMOL/L') unitVal = 'mmol/L';
                                else if (u === 'MEQ/L') unitVal = 'mEq/L';
                                
                                // Molar
                                else if (u === 'MMOL') unitVal = 'mmol';
                                else if (u === 'µMOL') unitVal = 'µmol';
                                else if (u === 'NMOL') unitVal = 'nmol'; // Supported?

                                // Others
                                else if (u === 'MG/G') unitVal = null; // Map to %? Or add mg/g?
                            }
                         }


                    if (unitVal) { 
                         // Check for complex presentation "15 mg / 5 ml" if we found a normalized unit like mg/mL
                         // We derived unitVal from complex string "MG/ML".
                         // BUT the original partDosage might have been "15 MG / 5 ML".
                         // Logic below attempts to parse "Num Unit / Denom Unit"
                         
                         let presentation = undefined;
                         
                         // Clean string for parsing: replace comma with dot
                         const rawClean = partDosage.replace(',', '.');
                         // Regex for "15 MG / 5 ML" or "15MG/5ML"
                         // Group 1: Num Val, Group 2: Num Unit, Group 3: Denom Val, Group 4: Denom Unit
                         const complexMatch = rawClean.match(/^([0-9.]+)\s*([A-Z%µ]+)\s*\/\s*([0-9.]+)\s*([A-Z%µ]+)/i);
                         
                         if (complexMatch) {
                              const numVal = parseFloat(complexMatch[1]);
                              const numUnit = complexMatch[2].toLowerCase(); // normalized to lowercaseish
                              const denomVal = parseFloat(complexMatch[3]);
                              const denomUnit = complexMatch[4].toLowerCase();
                              
                              // Store "User Presentation"
                              // We only do this if it implies a "Concentration" that was collapsed to mg/mL
                              // User example: 15 MG / 5 ML -> 3 mg/mL
                              
                              // Verify if the calculated dosageVal (canonical) matches num/denom?
                              // Previously we parsed "15 MG / 5 ML" -> we likely matched "15" and "MG".
                              // Because regex `/^([0-9.,]+)\s*([A-Za-z%µ\/²³]+)?/` stops at space or slash usually?
                              // Actually `/` is inside the unit group `[A-Za-z%µ\/²³]+`.
                              // So "15 MG/5 ML" -> Match 1: 15, Match 2: MG/5? No.
                              
                              // Wait, "15 MG / 5 ML" has spaces.
                              // Regex `^([0-9.,]+)\s*([A-Za-z%µ\/²³]+)?`
                              // "15 MG..." -> 15 captured. Unit captured "MG". The rest "/ 5 ML" is ignored?
                              // If so, our current logic set dosage = 15, unit = mg.
                              // BUT for "15 MG / 5 ML", valid unit is mg/mL (3).
                              // So my previous logic was WRONG for this case. It captured 15 mg.
                              
                              // Fix:
                              // If specific complex pattern is found, OVERRIDE dosage and unit.
                              
                              // Recalculate canonical
                              // Ex: 15 mg / 5 ml -> 3 mg / ml
                              // We need compatibility checks (mg/ml, g/l etc)
                              
                              if (numUnit === 'mg' && denomUnit === 'ml') {
                                   dosageVal = numVal / denomVal;
                                   unitVal = 'mg/mL';
                                   presentation = {
                                        numerator: numVal,
                                        numeratorUnit: 'mg',
                                        denominator: denomVal,
                                        denominatorUnit: 'ml'
                                   };
                              }
                              // Add other cases if needed (g/L etc)
                         }

                         dciComposition.push({
                            dciId,
                            dosage: dosageVal,
                            unit: unitVal,
                            presentation: presentation
                        });
                    }
                }
            });
        }

        // Create Product
        const product = {
            id: generateId(),
            sahtyCode: generateSahtyCode(),
            code: "",
            name: nomComplet,
            type: "Médicament", 
            unit: "Boîte",
            unitsPerBox: unitsPerBoxStr ? parseInt(unitsPerBoxStr) : 1,
            description: "",
            form: forme,
            presentation: presentation,
            brandName: nomCommercial, // Spécialité
            marketInfo: {
                ppv: ppv,
                ph: ph,
                pfht: pfht
            },
            manufacturer: fabriquant,
            suppliers: [],
            profitMargin: 0,
            vatRate: 0,
            isSubdivisable: false,
            dciComposition: dciComposition,
            dciIds: dciComposition.map(c => c.dciId), 
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isEnabled: true
        };

        newProducts.push(product);
    }

    console.log(`Parsed ${newProducts.length} products.`);
    console.log(`Matched DCIs for products: ${matchCount} times.`);

    // Merge
    const finalProducts = [...existingProducts, ...newProducts];
    fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(finalProducts, null, 2));
    console.log('Successfully saved to products.json!');

} catch (err) {
    console.error('Error importing:', err);
}
