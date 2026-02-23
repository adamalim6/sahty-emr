import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as Papa from 'papaparse';

// Helper to normalize strings: lowercase, remove accents, trim spaces
function normalizeStr(str: string): string {
    if (!str) return '';
    return str.toString()
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/\r?\n|\r/g, " ") // replace newlines
        .replace(/\s+/g, " ") // collapse multiple spaces
        .trim();
}

// Function to safely check if a string contains another, with generic variations
function fuzzyMatch(pn: string, sp: string): boolean {
    return pn === sp || pn.startsWith(sp + ' ') || pn.startsWith(sp + '-');
}

// Map textual dosage back to a value/unit
function parseDosage(dosageStr: string) {
    if (!dosageStr) return null;
    let str = dosageStr.toString().trim();
    if (str.toUpperCase() === 'QS' || str.toUpperCase() === 'QSP') return null;
    
    // Replace comma with dot for decimals
    str = str.replace(',', '.');
    
    const cleaned = normalizeStr(str).replace(/\s+/g, "");
    
    // If purely numeric
    if (/^[\d.]+$/.test(cleaned)) {
        let valueStr = cleaned;
        if (valueStr.endsWith('.')) valueStr = valueStr.slice(0, -1);
        const value = parseFloat(valueStr);
        if (isNaN(value)) return null;
        return { value, unitText: '%' }; // Assume percentage
    }

    const match = cleaned.match(/^([\d.]+)(.+)/);
    if (!match) return null;
    let valueStr = match[1];
    if (valueStr.endsWith('.')) valueStr = valueStr.slice(0, -1);
    const value = parseFloat(valueStr);
    let unitText = match[2].toLowerCase().replace(/\./g, ""); // remove dots so "m.u.i" becomes "mui"
    return { value, unitText };
}


async function main() {
    // 1. Load the CSV File
    const filePath = '/Users/adamalim/Desktop/medicaments_data_vfinale_with_name_clean.csv';
    console.log(`Loading CSV Data...`);
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse(csvContent, { header: true, delimiter: ';', skipEmptyLines: true });
    const excelRows: any[] = parsed.data;
    console.log(`Loaded ${excelRows.length} rows from CSV.`);

    // 2. Connect to Database
    const client = new Client({
         user: 'sahty', host: 'localhost', database: 'sahty_global', password: 'sahty_dev_2026', port: 5432,
    });
    await client.connect();

    // 3. Load Units Catalog
    console.log("Loading units array...");
    const unitsRes = await client.query(`SELECT id, code FROM public.units`);
    const units: {id: string, code: string}[] = unitsRes.rows.map(r => ({
        id: r.id, 
        code: normalizeStr(r.code).replace(/\./g, "").replace(/\s+/g, "") // remove dots and spaces for comparison
    }));
    
    function resolveUnitId(unitStr: string): string | null {
        if (!unitStr) return null;
        let p = unitStr;
        // hardcode mappings
        if (p === 'mcg' || p === 'ug' || p === 'μg' || p === 'µgg' || p === '?g') p = 'µg';
        if (p === 'ml') p = 'mg'; // Sometimes ML was mistakenly used where MG was meant
        if (p === 'u' || p === 'units' || p === 'unites') p = 'ui';
        if (p === 'millionsui' || p === 'millions') p = 'mui';
        if (p === 'mgi' || p === 'mgiode') p = 'mg{i}';
        if (p === 'ufc') p = 'cfu';
        if (p === 'uff') p = 'ffu';
        if (p === 'unitespeywood' || p === 'speywood') p = 'speywood';

        let direct = units.find(u => u.code === p);
        if (direct) return direct.id;

        return null;
    }

    // 4. Load Global DCIs
    console.log("Loading global DCIs...");
    const dciRes = await client.query(`SELECT id, name FROM public.global_dci`);
    const globalDcis = dciRes.rows.map(r => ({id: r.id, name: normalizeStr(r.name)}));

    function resolveDciId(dciName: string): string | null {
        let norm = normalizeStr(dciName);
        if (norm === 'extrait allergenique' || norm === 'extraits allergeniques') {
            norm = normalizeStr("divers (extraits d'allergènes)");
        }

        for(const dci of globalDcis) {
            // Can be equal, or could involve "sodium", "potassium", etc., but let's try strict start
            if (dci.name === norm) return dci.id;
        }
        // Let's do a loose matching:
        for(const dci of globalDcis) {
            if (dci.name.includes(norm) || norm.includes(dci.name)) return dci.id;
        }
        return null;
    }

    // 5. Load the incomplete products
    console.log("Finding products missing DCIs...");
    const prodRes = await client.query(`SELECT id, name, dci_composition FROM public.global_products`);
    
    const targetProducts = [];

    for (const row of prodRes.rows) {
        let composition: any[] = [];
        if (row.dci_composition) {
            if (typeof row.dci_composition === 'string') {
                try { composition = JSON.parse(row.dci_composition); } catch (e) { }
            } else {
                composition = row.dci_composition;
            }
        }

        let isMissing = false;
        if (!Array.isArray(composition) || composition.length === 0) {
            isMissing = true;
        } else {
            // Check for missing values or un-resolved units
            for (const comp of composition) {
                const hasAmount = typeof comp.amount_value === 'number' && comp.amount_value > 0;
                const hasUnit = typeof comp.amount_unit_id === 'string' && comp.amount_unit_id.trim().length > 0;
                if (!hasAmount || !hasUnit) {
                    isMissing = true;
                    break;
                }
            }
        }
        
        if (isMissing) {
            targetProducts.push({ id: row.id, name: row.name });
        }
    }
    console.log(`Found ${targetProducts.length} target products.`);

    // 6. Map target products to Excel
    const successfullyMappedProducts: string[] = [];
    const partiallyMappedProducts: string[] = []; // Found in Excel but missing some mappings
    const unmappedProducts: string[] = []; // Not found in Excel at all
    const unmappedUnitsTracker = new Set<string>();

    console.log("Pre-normalizing CSV strings...");
    excelRows.forEach(r => {
        r._normSpec = normalizeStr(r['NOM_COMPLET']);
    });

    console.log("Matching products...");
    for (const product of targetProducts) {
        let matchedRow = null;
        const normPn = normalizeStr(product.name);
        
        for (const row of excelRows) {
            if (row._normSpec && fuzzyMatch(normPn, row._normSpec)) {
                matchedRow = row;
                break;
            }
        }

        if (matchedRow) {
            let successTracker = true;
            let partialReason = "";
            let proposedComposition: any[] = [];
            
            const rawSubstance = matchedRow['DCI'];
            const rawDosage = matchedRow['DOSAGE'];

            if (!rawSubstance) {
                successTracker = false; partialReason = "Missing DCI (Substance Active) in CSV";
            } else {
                const substances = rawSubstance.toString().split('//').map((s: string) => s.trim()).filter(Boolean);
                const dosages = (rawDosage || "").toString().split('/').map((s: string) => s.trim()).filter(Boolean);
                
                // Example logic to build composition
                // We'll map the ith substance to the ith dosage (or the first dosage if only 1 is listed but multiple substances, though usually it's aligned)
                for (let i = 0; i < substances.length; i++) {
                    const subName = substances[i];
                    const dosStr = dosages[i] || dosages[0] || "0"; 

                    const dciId = resolveDciId(subName);
                    const parsedDosage = parseDosage(dosStr);
                    let unitId = parsedDosage ? resolveUnitId(parsedDosage.unitText) : null;

                    if (!dciId) {
                        successTracker = false;
                        partialReason += `[DCI Not Found: ${subName}] `;
                    }
                    if (parsedDosage && parsedDosage.value > 0 && !unitId) {
                        successTracker = false;
                        partialReason += `[Unit Not Found: ${parsedDosage.unitText}] `;
                        unmappedUnitsTracker.add(parsedDosage.unitText);
                    } else if (!parsedDosage || parsedDosage.value <= 0) {
                        // Some items might not have a clear dosage, like "QS", "QSP"
                        successTracker = false;
                        partialReason += `[Invalid Dosage format: ${dosStr}] `;
                    }

                    proposedComposition.push({
                         dciId: dciId || null,
                         name: subName,
                         amount_value: parsedDosage ? parsedDosage.value : 0,
                         amount_unit_id: unitId || null
                    });
                }
            }

            if (successTracker) {
                successfullyMappedProducts.push(product.name);
            } else {
                partiallyMappedProducts.push(`${product.name} (Err: ${partialReason})`);
            }

        } else {
            unmappedProducts.push(product.name);
        }
    }


    let report = `=== DCI RESOLUTION AUDIT REPORT ===\n`;
    report += `Total Targeted Products: ${targetProducts.length}\n\n`;
    
    report += `### 1. Successfully Resolved Products (${successfullyMappedProducts.length})\n`;
    report += `These products were found in the Excel file, and their Molecules and Dosages successfully mapped to known IDs.\n\n`;
    report += successfullyMappedProducts.join('\n') + '\n\n';
    
    report += `---\n\n`;
    report += `### 2. Partially Resolved Products (${partiallyMappedProducts.length})\n`;
    report += `These products were found in the Excel file, but either their Molecule (DCI) or their Unit could not be matched with our database dictionaries.\n\n`;
    report += partiallyMappedProducts.join('\n') + '\n\n';

    report += `---\n\n`;
    report += `### 3. Products NOT Found in Excel (${unmappedProducts.length})\n`;
    report += `These products could not be fuzzy-matched to any 'Spécialité' in the Excel file.\n\n`;
    report += unmappedProducts.join('\n') + '\n\n';

    report += `---\n\n`;
    report += `### 4. Unmapped Dosage Units\n`;
    report += `The following dosage units from the Excel file were not matched to any unit in the database:\n\n`;
    report += Array.from(unmappedUnitsTracker).sort().join('\n') + '\n\n';

    const reportPath = path.join(process.cwd(), '../', 'dci_resolution_audit.txt');
    fs.writeFileSync(reportPath, report);
    
    console.log(`Audit complete. Extracted mapped DCI data.`);
    console.log(`Full report saved to: ${reportPath}`);
    
    await client.end();
}
main().catch(console.error);
