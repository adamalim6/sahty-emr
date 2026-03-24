const { Client } = require('pg');

const GLOBAL_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/sahty_global';

async function main() {
    const globalClient = new Client({ connectionString: GLOBAL_DB });
    let tenantDBs = [];
    try {
        await globalClient.connect();
        const res = await globalClient.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        tenantDBs = res.rows.map(r => r.datname);
    } finally {
        await globalClient.end();
    }

    for (const dbName of tenantDBs) {
        const client = new Client({ connectionString: `postgresql://sahty:sahty_dev_2026@localhost:5432/${dbName}` });
        try {
            await client.connect();
            const res = await client.query('SELECT count(*) FROM reference.lab_analyte_units');
            console.log(`${dbName}: ${res.rows[0].count} rows in lab_analyte_units`);
        } finally {
            await client.end();
        }
    }
}

main();
