import { Pool } from 'pg';

async function main() {
    const pool = new Pool({
        user: 'sahty',
        host: 'localhost',
        database: 'sahty_global',
        password: 'sahty_dev_2026',
        port: 5432,
    });

    try {
        const rulesCols = await pool.query(`SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'lab_reference_rules'`);
        console.log("lab_reference_rules schema:\n", rulesCols.rows.map(r => `${r.column_name} (${r.data_type}, default: ${r.column_default}, nullable: ${r.is_nullable})`).join('\n'));

        const profilesCols = await pool.query(`SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'lab_reference_profiles'`);
        console.log("lab_reference_profiles schema:\n", profilesCols.rows.map(r => `${r.column_name} (${r.data_type}, default: ${r.column_default}, nullable: ${r.is_nullable})`).join('\n'));
        
        const cxCols = await pool.query(`SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'lab_analyte_contexts'`);
        console.log("lab_analyte_contexts schema:\n", cxCols.rows.map(r => `${r.column_name} (${r.data_type}, default: ${r.column_default}, nullable: ${r.is_nullable})`).join('\n'));
        
        const laaCols = await pool.query(`SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'lab_act_analytes'`);
        console.log("lab_act_analytes schema:\n", laaCols.rows.map(r => `${r.column_name} (${r.data_type}, default: ${r.column_default}, nullable: ${r.is_nullable})`).join('\n'));

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

main().catch(console.error);
