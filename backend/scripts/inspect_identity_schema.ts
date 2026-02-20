
import { identityQuery } from '../db/identityPg';
import { Pool } from 'pg';

async function inspect() {
    console.log("🔍 Inspecting sahty_identity schema...");
    try {
        const res = await identityQuery(`
            SELECT table_name, column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'identity'
            ORDER BY table_name, ordinal_position
        `);
        
        const tables: Record<string, string[]> = {};
        res.forEach((r: any) => {
            if (!tables[r.table_name]) tables[r.table_name] = [];
            tables[r.table_name].push(`${r.column_name} (${r.data_type})`);
        });

        console.log(JSON.stringify(tables, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        // Force exit as pool might hang
        process.exit(0);
    }
}

inspect();
