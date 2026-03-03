import { globalQuery } from '../db/globalPg';

async function check() {
    try {
        const types = await globalQuery('SELECT DISTINCT value_type FROM global_observation_parameters');
        console.log("Global Parameter Value Types:", types.rows.map(t => t.value_type));
    } catch(e) { console.error(e) }
    process.exit(0);
}
check();
