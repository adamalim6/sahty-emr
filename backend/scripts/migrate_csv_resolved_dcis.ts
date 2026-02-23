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
    const filePath = '/Users/adamalim/Desktop/medicaments_data_vfinale_with_name_clean.csv';
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse(csvContent, { header: true, delimiter: ';', skipEmptyLines: true });
    const excelRows: any[] = parsed.data;

    const client = new Client({
         user: 'sahty', host: 'localhost', database: 'sahty_global', password: 'sahty_dev_2026', port: 5432,
    });
    await client.connect();

    const unitsRes = await client.query(`SELECT id, code FROM public.units`);
    const units: {id: string, code: string}[] = unitsRes.rows.map(r => ({
        id: r.id, 
        code: normalizeStr(r.code).replace(/\./g, "").replace(/\s+/g, "")
    }));
    
    function resolveUnitId(unitStr: string): string | null {
        if (!unitStr) return null;
        let p = unitStr;
        
        if (p === 'mcg' || p === 'ug' || p === 'μg' || p === 'µgg' || p === '?g') p = 'µg';
        if (p === 'ml') p = 'mg';
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

    const dciRes = await client.query(`SELECT id, name FROM public.global_dci`);
    const globalDcis = dciRes.rows.map(r => ({id: r.id, name: normalizeStr(r.name)}));

    function resolveDciId(dciName: string): string | null {
        let norm = normalizeStr(dciName);
        if (norm === 'extrait allergenique' || norm === 'extraits allergeniques') {
            norm = normalizeStr("divers (extraits d'allergènes)");
        }

        for(const dci of globalDcis) {
            if (dci.name === norm) return dci.id;
        }
        for(const dci of globalDcis) {
            if (dci.name.includes(norm) || norm.includes(dci.name)) return dci.id;
        }
        return null;
    }

    const prodRes = await client.query(`SELECT id, name, dci_composition FROM public.global_products`);
    const targetProducts = [];

    for (const row of prodRes.rows) {
        let composition: any[] = [];
        if (row.dci_composition) {
            if (typeof row.dci_composition === 'string') {
                try { composition = JSON.parse(row.dci_composition); } catch (e) { }
            } else { composition = row.dci_composition; }
        }

        let isMissing = false;
        if (!Array.isArray(composition) || composition.length === 0) {
            isMissing = true;
        } else {
            for (const comp of composition) {
                const hasAmount = typeof comp.amount_value === 'number' && comp.amount_value > 0;
                const hasUnit = typeof comp.amount_unit_id === 'string' && comp.amount_unit_id.trim().length > 0;
                if (!hasAmount || !hasUnit) { isMissing = true; break; }
            }
        }
        
        if (isMissing) {
            targetProducts.push({ id: row.id, name: row.name });
        }
    }

    const successfullyMappedProducts: {id: string, name: string, composition: any[]}[] = [];
    excelRows.forEach(r => { r._normSpec = normalizeStr(r['NOM_COMPLET']); });

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
            let proposedComposition: any[] = [];
            
            const rawSubstance = matchedRow['DCI'];
            const rawDosage = matchedRow['DOSAGE'];

            if (!rawSubstance) {
                successTracker = false;
            } else {
                const substances = rawSubstance.toString().split('//').map((s: string) => s.trim()).filter(Boolean);
                const dosages = (rawDosage || "").toString().split('/').map((s: string) => s.trim()).filter(Boolean);
                
                for (let i = 0; i < substances.length; i++) {
                    const subName = substances[i];
                    const dosStr = dosages[i] || dosages[0] || "0"; 

                    const dciId = resolveDciId(subName);
                    const parsedDosage = parseDosage(dosStr);
                    let unitId = parsedDosage ? resolveUnitId(parsedDosage.unitText) : null;

                    if (!dciId || (parsedDosage && parsedDosage.value > 0 && !unitId) || (!parsedDosage || parsedDosage.value <= 0)) {
                        successTracker = false;
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
                successfullyMappedProducts.push({ id: product.id, name: product.name, composition: proposedComposition });
            }
        }
    }

    if (successfullyMappedProducts.length === 0) {
        console.log("No new products to migrate.");
        await client.end();
        return;
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
        }

        await client.query('COMMIT');
        console.log(`\n✅ Migration successful! Updated ${count} products.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("\\n❌ Migration failed! Rolled back.", err);
    }
    
    await client.end();
}
main().catch(console.error);
