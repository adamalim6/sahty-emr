import { Client } from 'pg';
import * as fs from 'fs';
import * as Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    const filePath = '/Users/adamalim/Desktop/dci_atc5_mapping.csv';
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    const rows = parsed.data as any[];

    console.log(`Read ${rows.length} rows from CSV`);

    const client = new Client({
        user: 'sahty', host: 'localhost', database: 'sahty_global', password: 'sahty_dev_2026', port: 5432,
    });
    await client.connect();

    // Check existing
    const existingRes = await client.query('SELECT name FROM public.global_dci');
    const existingNames = new Set(existingRes.rows.map(r => r.name.toLowerCase()));

    let inserted = 0;
    let skipped = 0;

    try {
        await client.query('BEGIN');
        
        for (const row of rows) {
            const dciName = row.dci_name?.trim();
            if (!dciName) continue;

            if (existingNames.has(dciName.toLowerCase())) {
                console.log(`Skipping existing DCI: ${dciName}`);
                skipped++;
                continue;
            }

            let atcCode = null;
            if (row.notes !== 'UNMAPPED') {
                atcCode = row.atc5_code?.trim() || row.atc4_code?.trim() || null;
            }

            const newId = uuidv4();
            await client.query(
                `INSERT INTO public.global_dci (id, name, atc_code, created_at) VALUES ($1, $2, $3, NOW())`,
                [newId, dciName.toUpperCase(), atcCode]
            );
            inserted++;
        }

        await client.query('COMMIT');
        console.log(`Successfully inserted ${inserted} new DCIs.`);
        console.log(`Skipped ${skipped} existing DCIs.`);
        
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error during import:', e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
