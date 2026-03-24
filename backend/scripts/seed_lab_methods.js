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
    const codeIdx = headers.indexOf('code');
    const libelleIdx = headers.indexOf('libelle');
    const descIdx = headers.indexOf('description');
    const actifIdx = headers.indexOf('actif');
    const sortIdx = headers.indexOf('sort_order');
    
    if ([codeIdx, libelleIdx, descIdx, actifIdx, sortIdx].includes(-1)) {
        throw new Error("Missing required columns in CSV (code, libelle, description, actif, sort_order)");
    }

    const payload = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length <= codeIdx || !row[codeIdx]) continue;
        
        let isActif = true;
        if (row[actifIdx].toLowerCase() === 'false' || row[actifIdx] === '0') {
            isActif = false;
        }
        
        payload.push({
            code: row[codeIdx],
            libelle: row[libelleIdx] || null,
            description: row[descIdx] || null,
            actif: isActif,
            sort_order: row[sortIdx] ? parseInt(row[sortIdx], 10) : 10
        });
    }
    return payload;
}

async function executeMethodSeed() {
    console.log('Loading exhaustive Methods CSV payload...');
    const payload = loadCsvData('/Users/adamalim/Desktop/lab_methods_CHU_exhaustive.csv');
    console.log(`Parsed ${payload.length} method records from dictionary.`);
    
    const client = await globalPool.connect();
    let updatedCount = 0;
    
    try {
        await client.query('BEGIN');
        const query = `
            INSERT INTO public.lab_methods (
                id, code, libelle, description, actif, sort_order, created_at, updated_at
            )
            VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW()
            )
            ON CONFLICT (code) DO UPDATE 
            SET 
                libelle = EXCLUDED.libelle,
                description = EXCLUDED.description,
                actif = EXCLUDED.actif,
                sort_order = EXCLUDED.sort_order,
                updated_at = NOW();
        `;
        
        for (const row of payload) {
            const res = await client.query(query, [
                row.code,
                row.libelle,
                row.description,
                row.actif,
                row.sort_order
            ]);
            // If rowCount > 0, it means it either inserted or actually updated a row.
            updatedCount += 1; // Since it's a loop of N logic guarantees N processed
        }
        await client.query('COMMIT');
        
        const countRes = await client.query(`SELECT count(*) FROM public.lab_methods;`);
        console.log(`[sahty_global] SUCCESS! Upserted ${payload.length} methods. Total global lab_methods count: ${countRes.rows[0].count}`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[sahty_global] FAILED:`, e.message);
    } finally {
        client.release();
        await globalPool.end();
    }
}

executeMethodSeed();
