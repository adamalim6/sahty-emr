
import { globalQuery } from '../db/globalPg';

async function checkColumns() {
    const tables = [
        'patients_global'
    ];

    for (const table of tables) {
        console.log(`\n--- ${table} ---`);
        try {
            const cols = await globalQuery(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position
            `, [table]);
            
            if (cols.length === 0) {
                console.log('Table does not exist!');
            } else {
                console.table(cols);
            }
        } catch (e: any) {
            console.error(e.message);
        }
    }
}

checkColumns().catch(console.error);
