import { getGlobalPool } from './db/globalPg';
import { getTenantPool } from './db/tenantPg';

async function verify() {
    const pool1 = getGlobalPool();
    const res1 = await pool1.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'global_products' AND column_name = 'default_presc_unit'");
    console.log('Global Db Type:', res1.rows[0]);
    await pool1.end();

    const pool2 = getTenantPool('ced91ced-fe46-45d1-8ead-b5d51bad5895');
    const res2 = await pool2.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'reference' AND table_name = 'global_products' AND column_name = 'default_presc_unit'");
    console.log('Tenant Db Type:', res2.rows[0]);
    await pool2.end();
}

verify().catch(console.error);
