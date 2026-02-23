import { Client } from 'pg';
import * as fs from 'fs';
import * as Papa from 'papaparse';

async function main() {
    const filePath = '/Users/adamalim/Desktop/dci_atc5_mapping.csv';
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    const rows = parsed.data as any[];

    const client = new Client({
        user: 'sahty', host: 'localhost', database: 'sahty_global', password: 'sahty_dev_2026', port: 5432,
    });
    await client.connect();

    const dciNamesToRevert = rows.map(r => r.dci_name?.trim().toUpperCase()).filter(Boolean);
    console.log(`Found ${dciNamesToRevert.length} DCI names from CSV to potentially revert.`);

    try {
        await client.query('BEGIN');
        
        let deletedCount = 0;
        
        for (const name of dciNamesToRevert) {
            // Delete only those that were created today/recently to be extra safe
            const res = await client.query(
                `DELETE FROM public.global_dci WHERE name = $1 AND created_at >= NOW() - INTERVAL '1 day' RETURNING id`,
                [name]
            );
            deletedCount += res.rowCount || 0;
        }

        await client.query('COMMIT');
        console.log(`Successfully reverted (deleted) ${deletedCount} recently added DCIs.`);
        
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error during revert:', e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
