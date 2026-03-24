const fs = require('fs');
const { Pool } = require('pg');

const globalPool = new Pool({ connectionString: 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global' });

function parseCsvLine(text) {
    let ret = [];
    let inQuote = false;
    let curr = '';
    for (let c of text) {
        if (c === '"') {
            inQuote = !inQuote;
        } else if (c === ',' && !inQuote) {
            ret.push(curr);
            curr = '';
        } else {
            curr += c;
        }
    }
    ret.push(curr);
    return ret.map(s => s.trim());
}

function loadCsvData(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    
    const headers = parseCsvLine(lines[0]);
    const actIdx = headers.indexOf('global_act_id');
    const methodIdx = headers.indexOf('method_id');
    const defIdx = headers.indexOf('is_default');
    const actifIdx = headers.indexOf('actif');
    
    if ([actIdx, methodIdx, defIdx, actifIdx].includes(-1)) {
        throw new Error("Missing required columns in CSV (global_act_id, method_id, is_default, actif)");
    }

    const payload = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length <= methodIdx || !row[methodIdx]) continue;
        
        let isActif = true;
        if (row[actifIdx].toLowerCase() === 'false' || row[actifIdx] === '0') isActif = false;
        
        let isDefault = true;
        if (row[defIdx].toLowerCase() === 'false' || row[defIdx] === '0') isDefault = false;
        
        payload.push({
            global_act_id: row[actIdx],
            method_id: row[methodIdx],
            is_default: isDefault,
            actif: isActif
        });
    }
    return payload;
}

async function executeMethodMappingSeed() {
    console.log('Loading associative Mapping CSV payload...');
    const payload = loadCsvData('/Users/adamalim/Desktop/lab_act_methods_CHU_refined.csv');
    console.log(`Parsed ${payload.length} mapping records from CSV.`);
    
    const client = await globalPool.connect();
    let updatedCount = 0;
    
    try {
        await client.query('BEGIN');
        
        // Ensure atomic reset since we are providing the definitive list
        console.log('Truncating outdated mappings natively before mass-insjection...');
        await client.query('TRUNCATE TABLE public.lab_act_methods;');
        
        // Because we truncated, we don't even need ON CONFLICT, making the script purely robust.
        // We do batch inserts to be ultra-fast.
        const query = `
            INSERT INTO public.lab_act_methods (
                id, global_act_id, method_id, is_default, actif, created_at, updated_at
            )
            VALUES (
                gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()
            );
        `;
        
        for (const row of payload) {
            await client.query(query, [
                row.global_act_id,
                row.method_id,
                row.is_default,
                row.actif
            ]);
            updatedCount += 1;
        }
        await client.query('COMMIT');
        
        const countRes = await client.query(`SELECT count(*) FROM public.lab_act_methods;`);
        console.log(`[sahty_global] SUCCESS! Completely remapped and inserted ${payload.length} methods. Total global lab_act_methods count: ${countRes.rows[0].count}`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[sahty_global] FAILED:`, e.message);
    } finally {
        client.release();
        await globalPool.end();
    }
}

executeMethodMappingSeed();
