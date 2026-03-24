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
    const idIdx = headers.indexOf('id');
    const minVolIdx = headers.indexOf('min_volume');
    const unitIdIdx = headers.indexOf('volume_unit_id');
    const unitLblIdx = headers.indexOf('volume_unit_label');
    
    if (idIdx === -1 || minVolIdx === -1 || unitIdIdx === -1 || unitLblIdx === -1) {
        throw new Error("Missing required columns in CSV");
    }

    const payload = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (row.length <= idIdx) continue;
        
        payload.push({
            global_act_id: row[headers.indexOf('global_act_id')],
            specimen_type_id: row[headers.indexOf('specimen_type_id')],
            min_volume: row[minVolIdx] === '' ? null : parseFloat(row[minVolIdx]),
            volume_unit_id: row[unitIdIdx] === '' ? null : row[unitIdIdx],
            volume_unit_label: row[unitLblIdx] === '' ? null : row[unitLblIdx]
        });
    }
    return payload;
}

async function executeBatchUpdate(client, schema, payload, dbName) {
    let updatedCount = 0;
    try {
        await client.query('BEGIN');
        const query = `
            UPDATE ${schema}.lab_act_specimen_types 
            SET 
                min_volume = $1,
                volume_unit_id = $2,
                volume_unit_label = $3
            WHERE global_act_id = $4 AND specimen_type_id = $5
        `;
        
        for (const row of payload) {
            const res = await client.query(query, [
                row.min_volume,
                row.volume_unit_id,
                row.volume_unit_label,
                row.global_act_id,
                row.specimen_type_id
            ]);
            updatedCount += res.rowCount;
        }
        await client.query('COMMIT');
        
        const countRes = await client.query(`SELECT count(*) FROM ${schema}.lab_act_specimen_types WHERE volume_unit_id IS NOT NULL;`);
        console.log(`[${dbName}] SUCCESS! Updated ${updatedCount} rows. Total rows with configured volume_unit_id: ${countRes.rows[0].count}`);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[${dbName}] FAILED:`, e.message);
    }
}

async function run() {
    console.log('Loading CSV payload...');
    const payload = loadCsvData('/Users/adamalim/Desktop/act_specimen_reverified.csv');
    console.log(`Loaded ${payload.length} mapping rows directly targeting by ID.`);
    
    const globalClient = await globalPool.connect();
    
    try {
        console.log('\n--- Patching sahty_global ---');
        await executeBatchUpdate(globalClient, 'public', payload, 'sahty_global');
        
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        const tenants = res.rows.map(r => r.datname);
        
        console.log(`\n--- Patching ${tenants.length} tenants ---`);
        for (const t of tenants) {
            const tPool = new Pool({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${t}` });
            const tClient = await tPool.connect();
            try {
                await executeBatchUpdate(tClient, 'reference', payload, t);
            } finally {
                tClient.release();
                await tPool.end();
            }
        }
        
    } catch (e) {
        console.error('[FATAL STARTUP]', e);
    } finally {
        globalClient.release();
        await globalPool.end();
    }
}

run();
