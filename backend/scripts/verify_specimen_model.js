const { Client } = require('pg');

// We will verify on one of the tenant databases
const TENANT_DB = 'postgresql://sahty:sahty_dev_2026@localhost:5432/tenant_ced91ced-fe46-45d1-8ead-b5d51bad5895';

async function main() {
    const client = new Client({ connectionString: TENANT_DB });
    let specId, cont1Id, cont2Id;

    try {
        await client.connect();
        console.log("Connected to tenant_ced91ced...");

        // 1. Verify column structure
        const cols = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'lab_specimen_types' AND table_schema = 'reference'
        `);
        const names = cols.rows.map(r => r.column_name);
        if (!names.includes('base_specimen') || !names.includes('matrix_type')) {
            throw new Error("Missing new columns in lab_specimen_types");
        }
        console.log("✅ Column structure verified.");

        // Clean up from any previous test runs
        await client.query(`
            DELETE FROM reference.lab_specimen_container_types 
            WHERE specimen_type_id IN (SELECT id FROM reference.lab_specimen_types WHERE code LIKE 'TEST_SPEC_%')
        `);
        await client.query(`DELETE FROM reference.lab_specimen_types WHERE code LIKE 'TEST_SPEC_%'`);
        await client.query(`DELETE FROM reference.lab_container_types WHERE code LIKE 'TEST_CONT_%'`);

        // 2. Insert sample specimen
        const spec = await client.query(`
            INSERT INTO reference.lab_specimen_types (code, libelle, base_specimen, matrix_type) 
            VALUES ('TEST_SPEC_1', 'Test Blood', 'BLOOD', 'SERUM') RETURNING id
        `);
        specId = spec.rows[0].id;
        console.log("✅ Sample specimen inserted.");

        // 3. Insert specific container
        const cont1 = await client.query(`
            INSERT INTO reference.lab_container_types (code, libelle, additive_type) 
            VALUES ('TEST_CONT_1', 'EDTA Tube', 'EDTA') RETURNING id
        `);
        cont1Id = cont1.rows[0].id;
        console.log("✅ Sample container inserted.");

        // 4. Link them (default = true)
        await client.query(`
            INSERT INTO reference.lab_specimen_container_types (specimen_type_id, container_type_id, is_default)
            VALUES ($1, $2, true)
        `, [specId, cont1Id]);
        console.log("✅ Successfully linked specimen to container (is_default=true).");

        // 5. Intentional Violation: Add same link again -> UNIQUE constraint
        try {
            await client.query(`
                INSERT INTO reference.lab_specimen_container_types (specimen_type_id, container_type_id, is_default)
                VALUES ($1, $2, false)
            `, [specId, cont1Id]);
            throw new Error("Should have failed on duplicate unique link!");
        } catch (e) {
            if (e.message.includes("unique_specimen_container")) {
                console.log("✅ Caught unique constraint violation correctly.");
            } else {
                throw e;
            }
        }

        // 6. Intentional Violation: Add second default container to same specimen -> Partial Index constraint
        const cont2 = await client.query(`
            INSERT INTO reference.lab_container_types (code, libelle, additive_type) 
            VALUES ('TEST_CONT_2', 'Heparin Tube', 'HEPARIN') RETURNING id
        `);
        cont2Id = cont2.rows[0].id;

        try {
            await client.query(`
                INSERT INTO reference.lab_specimen_container_types (specimen_type_id, container_type_id, is_default)
                VALUES ($1, $2, true)
            `, [specId, cont2Id]);
            throw new Error("Should have failed on partial unique default constraint!");
        } catch (e) {
            if (e.message.includes("uniq_default_container_per_specimen_tenant")) {
                console.log("✅ Caught partial index (is_default=true) violation correctly.");
            } else {
                throw e;
            }
        }

        console.log("🔥 Everything working flawlessly!");

    } catch (e) {
        console.error("❌ Verification failed:", e.message);
    } finally {
        // Cleanup test data
        if (client) {
            await client.query(`
                DELETE FROM reference.lab_specimen_container_types 
                WHERE specimen_type_id IN (SELECT id FROM reference.lab_specimen_types WHERE code LIKE 'TEST_SPEC_%')
            `);
            await client.query(`DELETE FROM reference.lab_specimen_types WHERE code LIKE 'TEST_SPEC_%'`);
            await client.query(`DELETE FROM reference.lab_container_types WHERE code LIKE 'TEST_CONT_%'`);
            await client.end();
        }
    }
}

main().catch(console.error);
