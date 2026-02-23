import { getTenantPool } from '../db/tenantPg';

async function clean() {
    const pool = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const client = await pool.connect();
    try {
        console.log('[+] Dropping corrupted public catalog tables from ced91ced-fe46-45d1-8ead-b5d51bad5895');
        await client.query(`
            DROP TABLE IF EXISTS public.flowsheet_groups CASCADE;
            DROP TABLE IF EXISTS public.group_parameters CASCADE;
            DROP TABLE IF EXISTS public.observation_parameters CASCADE;
            DROP TABLE IF EXISTS public.observation_groups CASCADE;
            DROP TABLE IF EXISTS public.observation_flowsheets CASCADE;
        `);
        console.log('[+] Cleaned successfully');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}
clean();
