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
        const categoryCondition = `type_acte = 'BIOLOGY'`;

        const actCount = await pool.query(`SELECT COUNT(*) FROM public.global_actes WHERE ${categoryCondition}`);
        console.log("1. Total BIOLOGY Global Acts:", actCount.rows[0].count);

        const mappedActs = await pool.query(`
            SELECT COUNT(DISTINCT ga.id) 
            FROM public.global_actes ga
            JOIN public.lab_act_analytes laa ON ga.id = laa.global_act_id
            WHERE ${categoryCondition}
        `);
        console.log("2. BIOLOGY Acts with an analyte context mapped:", mappedActs.rows[0].count);

        const mappedContexts = await pool.query(`
            SELECT COUNT(DISTINCT laa.analyte_id)
            FROM public.global_actes ga
            JOIN public.lab_act_analytes laa ON ga.id = laa.global_act_id
            WHERE ${categoryCondition}
        `);
        console.log("Total distinct analyte contexts mapped to those acts:", mappedContexts.rows[0].count);

        const profilesMapped = await pool.query(`
            SELECT COUNT(DISTINCT lrp.analyte_context_id)
            FROM public.lab_reference_profiles lrp
            JOIN public.lab_act_analytes laa ON laa.analyte_id = lrp.analyte_context_id
            JOIN public.global_actes ga ON ga.id = laa.global_act_id
            WHERE ${categoryCondition}
        `);
        console.log("3. Total distinct analyte contexts (that are mapped to those acts) having a reference profile:", profilesMapped.rows[0].count);

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await pool.end();
    }
}

main().catch(console.error);
