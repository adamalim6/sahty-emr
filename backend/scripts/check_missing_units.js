const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';
const uuids = [
    '76d79a73-be91-47ff-9dff-5a29a182f3fd',
    '311f23f0-d95d-42c9-9975-b1120a01375b',
    'e15ffd52-575d-42f5-acd1-108d7d0997e1'
];

async function main() {
    const client = new Client({ connectionString: GLOBAL_DB });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, code, display 
            FROM public.units 
            WHERE id = ANY($1)
        `, [uuids]);
        
        console.log("Found in sahty_global.public.units:");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
