import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';

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
    // Example: "250 mg", "50 µg", "1 g"
    const cleaned = normalizeStr(dosageStr);
    const match = cleaned.match(/^([\d.,]+)\s*([a-zA-Zµ%/:*]+)/);
    if (!match) return null;
    let valueStr = match[1].replace(',', '.');
    // strip trailing dots like "1." -> "1"
    if (valueStr.endsWith('.')) valueStr = valueStr.slice(0, -1);
    const value = parseFloat(valueStr);
    const unitText = match[2];
    return { value, unitText };
}


async function main() {
    // 1. Load the Excel File
    const filePath = '/Users/adamalim/Desktop/medicaments_data.xlsx';
    console.log(`Loading Excel Data...`);
    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const excelRows: any[] = xlsx.utils.sheet_to_json(worksheet);
    console.log(`Loaded ${excelRows.length} rows from Excel.`);

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
        code: normalizeStr(r.code)
    }));
    
    function resolveUnitId(unitStr: string): string | null {
        if (!unitStr) return null;
        let p = normalizeStr(unitStr);
        // hardcode mappings
        if (p === 'mcg' || p === 'ug' || p === 'μg') p = 'µg';
        if (p === 'ml') p = 'mg'; // Sometimes ML was mistakenly used where MG was meant, but let's just map it to ml
        if (p === 'u' || p === 'u.i' || p === 'ui') p = 'ui';
        if (p === 'm.u.i' || p === 'mui') p = 'mui';
        if (p === 'u.ceip' || p === 'uceip') p = 'u ceip';

        let direct = units.find(u => u.code === p);
        if (direct) return direct.id;

        return null;
    }

    // 4. Load Global DCIs
    console.log("Loading global DCIs...");
    const dciRes = await client.query(`SELECT id, name FROM public.global_dci`);
    const globalDcis = dciRes.rows.map(r => ({id: r.id, name: normalizeStr(r.name)}));

    function resolveDciId(dciName: string): string | null {
        const norm = normalizeStr(dciName);
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
    const successfullyMappedProducts: {id: string, name: string, composition: any[]}[] = [];
    const partiallyMappedProducts: string[] = []; // Found in Excel but missing some mappings
    const unmappedProducts: string[] = []; // Not found in Excel at all

    console.log("Pre-normalizing Excel strings...");
    excelRows.forEach(r => {
        r._normSpec = normalizeStr(r['SPECIALITE']);
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
            
            const rawSubstance = matchedRow['SUBSTANCE ACTIVE'];
            const rawDosage = matchedRow['DOSAGE'];

            if (!rawSubstance) {
                successTracker = false; partialReason = "Missing Substance Active in Excel";
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
                successfullyMappedProducts.push({
                    id: product.id,
                    name: product.name,
                    composition: proposedComposition
                });
            } else {
                partiallyMappedProducts.push(`${product.name} (Err: ${partialReason})`);
            }

        } else {
            unmappedProducts.push(product.name);
        }
    }


    console.log(`\nReady to migrate ${successfullyMappedProducts.length} successfully mapped products.`);

    try {
        await client.query('BEGIN');
        console.log("Starting transaction...");
        
        let count = 0;
        for (const target of successfullyMappedProducts) {
            await client.query(
                `UPDATE public.global_products SET dci_composition = $1, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify(target.composition), target.id]
            );
            count++;
            if (count % 100 === 0) console.log(`Migrated ${count} products...`);
        }

        await client.query('COMMIT');
        console.log(`\n✅ Migration successful! Updated ${count} products in sahty_global.global_products.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("\\n❌ Migration failed! Rolled back.", err);
    }
    
    await client.end();
}
main().catch(console.error);
