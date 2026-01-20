const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Paths
// DIRECT DESKTOP PATH AS REQUESTED
const CSV_PATH = '/Users/adamalim/Desktop/medicaments_data_vfinale_with_name_clean.csv';
const DCI_PATH = path.join(__dirname, '../data/global/dci.json');
const PRODUCTS_PATH = path.join(__dirname, '../data/global/products.json');

// Helper to generate IDs
const generateId = () => crypto.randomUUID();
// Helper for Sahty Code (Sequential-ish random)
const generateSahtyCode = () => 'SAH-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

// Helper to parse numbers (French format 1 234,56 -> 1234.56)
const parseFrenchNumber = (val) => {
    if (val === undefined || val === null) return undefined;
    const str = String(val).trim().replace(/"/g, ''); // Remove quotes
    if (!str) return undefined;
    
    // Remove thousand separators (space) and replace decimal comma with dot
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
console.log('Starting Import of Moroccan Medications (MANUAL PARSER)...');

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

// 2. Read CSV manually (Node fs) to avoid XLSX locale issues
try {
    console.log(`Reading CSV file raw from: ${CSV_PATH}`);
    const fileContent = fs.readFileSync(CSV_PATH, { encoding: 'utf8' });
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    console.log(`Total Rows in CSV: ${lines.length}`);
    
    // Parse Header
    const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
    console.log("Headers:", headers);
    
    // Map Indexes
    const idxNomComplet = headers.indexOf('NOM_COMPLET');
    const idxNomCommercial = headers.indexOf('Nom commercial');
    const idxDosage = headers.indexOf('DOSAGE');
    const idxForme = headers.indexOf('FORME');
    const idxPresentation = headers.indexOf('PRESENTATION');
    const idxDCI = headers.indexOf('DCI');
    const idxFabriquant = headers.indexOf('FABRIQUANT');
    const idxPPV = headers.indexOf('PPV');
    const idxPH = headers.indexOf('PH');
    const idxPFHT = headers.indexOf('PFHT');
    const idxUnitPerBox = headers.indexOf('UNITES_PAR_BOITE');

    if (idxNomComplet === -1 || idxDCI === -1) {
        throw new Error("Missing critical headers (NOM_COMPLET or DCI)");
    }

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

    // Iterate Rows (Skip header)
    for (let i = 1; i < lines.length; i++) {
        const rowRaw = lines[i];
        const cols = rowRaw.split(';');
        
        // Helper to get safe value
        const getVal = (idx) => idx !== -1 && cols[idx] ? cols[idx].trim().replace(/"/g, '') : '';

        const nomComplet = getVal(idxNomComplet);
        if (!nomComplet) continue;

        const nomCommercial = getVal(idxNomCommercial);
        const dosageStr = getVal(idxDosage);
        const forme = getVal(idxForme);
        const presentation = getVal(idxPresentation);
        const dciStr = getVal(idxDCI);
        const fabriquant = getVal(idxFabriquant);
        
        // Use manual parser for numbers
        const ppv = parseFrenchNumber(getVal(idxPPV));
        const ph = parseFrenchNumber(getVal(idxPH));
        const pfht = parseFrenchNumber(getVal(idxPFHT));
        const unitsPerBoxStr = getVal(idxUnitPerBox);

        // Parse DCI Composition
        let dciComposition = [];
        if (dciStr) {
            // Valid delimiters: //, +, or newline
            const dciNames = String(dciStr).split(/\/\/|\+|\n/).map(s => s.trim()).filter(s => s);
            const dosageStrClean = dosageStr ? String(dosageStr).trim() : '';
            
            let dosageParts = [];

            // COMPLEX DOSAGE LOGIC
            if (dosageStrClean.includes('+')) {
                 dosageParts = dosageStrClean.split('+').map(s => s.trim());
            } else if (dosageStrClean.indexOf('/') !== -1) {
                 const slashParts = dosageStrClean.split('/').map(s => s.trim());
                 if (dciNames.length === slashParts.length && dciNames.length > 1) {
                      dosageParts = slashParts;
                 } else {
                      if (dciNames.length > 1 && slashParts.length > dciNames.length) {
                           dosageParts = slashParts;
                      } else {
                          if (dciNames.length > 1) {
                              dosageParts = slashParts;
                          } else {
                               dosageParts = [dosageStrClean];
                          }
                      }
                 }
            } else {
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
                         partDosage = dosageStrClean;
                    }
                    
                    let dosageVal = undefined;
                    let unitVal = undefined;

                    const numberMatch = partDosage.match(/^([0-9.,]+)\s*([A-Za-z%µ\/²³]+)?/);
                    if (numberMatch) {
                        dosageVal = parseFloat(numberMatch[1].replace(',', '.'));
                        let unitRaw = numberMatch[2] ? numberMatch[2].trim() : ''; 
                        
                        // Normalization of Unit
                        if (!unitRaw) {
                            if (dosageVal <= 1) { 
                                    dosageVal = dosageVal * 100;
                                    unitVal = '%';
                            } else {
                                unitVal = 'mg'; 
                            }
                        } else {
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
                                else if (u === 'MG/ML') unitVal = 'mg/mL';
                                else if (u === 'MCG/ML' || u === 'µG/ML') unitVal = 'mcg/mL';
                                else if (u === 'NG/ML') unitVal = 'ng/mL';
                                else if (u === 'IU/ML' || u === 'UI/ML') unitVal = 'IU/mL';
                                else if (u === 'U/ML') unitVal = 'U/mL';
                                else if (u === 'G/L') unitVal = 'g/L';
                                else if (u === 'MMOL/L') unitVal = 'mmol/L';
                                else if (u === 'MEQ/L') unitVal = 'mEq/L';
                                else if (u === 'MMOL') unitVal = 'mmol';
                                else if (u === 'µMOL') unitVal = 'µmol';
                                else if (u === 'NMOL') unitVal = 'nmol';
                                else if (u === 'MG/G') unitVal = null; 
                            }
                         }

                    if (unitVal) { 
                         let presentation = undefined;
                         const rawClean = partDosage.replace(',', '.');
                         const complexMatch = rawClean.match(/^([0-9.]+)\s*([A-Z%µ]+)\s*\/\s*([0-9.]+)\s*([A-Z%µ]+)/i);
                         
                         if (complexMatch) {
                              const numVal = parseFloat(complexMatch[1]);
                              const numUnit = complexMatch[2].toLowerCase();
                              const denomVal = parseFloat(complexMatch[3]);
                              const denomUnit = complexMatch[4].toLowerCase();
                              
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

    console.log(`Parsed ${newProducts.length} products locally.`);
    console.log(`Matched DCIs for products: ${matchCount} times.`);

    // Merge
    const finalProducts = [...existingProducts, ...newProducts];
    fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(finalProducts, null, 2));
    console.log('Successfully saved to products.json!');

} catch (err) {
    console.error('Error importing:', err);
}
