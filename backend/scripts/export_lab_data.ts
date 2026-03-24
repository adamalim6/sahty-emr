import { globalQuery } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

function toCsv(rows: any[]) {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const csvRows = [headers.join(',')];
    for (const row of rows) {
        const values = headers.map(header => {
            const val = row[header];
            if (val === null || val === undefined) return '""';
            const escaped = String(val).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

async function exportData() {
    try {
        const desktopPath = path.join(process.env.HOME || '/Users/adamalim', 'Desktop');

        console.log('Querying units...');
        const units = await globalQuery('SELECT * FROM public.units ORDER BY code');
        const unitsPath = path.join(desktopPath, 'all_units.csv');
        fs.writeFileSync(unitsPath, toCsv(units));
        console.log(`Created: ${unitsPath}`);

        console.log('Querying sih_sous_familles (BIOLOGIE)...');
        const sousFamilles = await globalQuery(`
            SELECT sf.* 
            FROM public.sih_sous_familles sf
            JOIN public.sih_familles f ON sf.famille_id = f.id
            WHERE f.code = 'BIOLOGIE'
            ORDER BY sf.code
        `);
        const sousFamillesPath = path.join(desktopPath, 'biology_sih_sous_familles.csv');
        fs.writeFileSync(sousFamillesPath, toCsv(sousFamilles));
        console.log(`Created: ${sousFamillesPath}`);

        console.log('Querying global_actes (BIOLOGIE)...');
        const actes = await globalQuery(`
            SELECT ga.* 
            FROM public.global_actes ga
            JOIN public.sih_familles f ON ga.famille_id = f.id
            WHERE f.code = 'BIOLOGIE'
            ORDER BY ga.code_sih
        `);
        const actesPath = path.join(desktopPath, 'biology_global_actes.csv');
        fs.writeFileSync(actesPath, toCsv(actes));
        console.log(`Created: ${actesPath}`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

exportData();
