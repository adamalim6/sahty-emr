
import { globalQuery, closeGlobalPool } from '../db/globalPg';

async function inspect() {
    try {
        const res = await globalQuery(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'organismes'
            ORDER BY ordinal_position
        `);
        console.log("Columns in sahty_global.organismes:");
        res.forEach(r => console.log(` - ${r.column_name}`));
    } catch(e) {
        console.error(e);
    } finally {
        await closeGlobalPool();
    }
}
inspect();
