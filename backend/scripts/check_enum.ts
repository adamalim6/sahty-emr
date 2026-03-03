import { tenantQuery } from '../db/tenantPg';

async function check() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    try {
        const types = await tenantQuery(tenantId, 'SELECT DISTINCT value_type FROM reference.observation_parameters');
        console.log("Existing Value Types in DB:", types.map(t => t.value_type));
    } catch(e) { console.error(e) }
    process.exit(0);
}
check();
