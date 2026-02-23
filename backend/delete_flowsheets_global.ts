import { getGlobalPool } from './db/globalPg';

async function run() {
    const pool = getGlobalPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Delete flowing sheets
        await client.query(`DELETE FROM flowsheet_groups WHERE flowsheet_id IN ('bcf303ab-85e1-4616-9353-7f9427b267dd', 'bd1cd91b-1798-40a6-bcbb-7f095879fd27')`);
        await client.query(`DELETE FROM observation_flowsheets WHERE id IN ('bcf303ab-85e1-4616-9353-7f9427b267dd', 'bd1cd91b-1798-40a6-bcbb-7f095879fd27')`);
        
        console.log("Deleted old flowsheets");
        
        // Ensure no groups have duplicates
        await client.query(`
            DO $$
            DECLARE
                r RECORD;
                i INT := 1;
            BEGIN
                FOR r IN (
                    SELECT id FROM observation_groups ORDER BY created_at
                ) LOOP
                    UPDATE observation_groups SET sort_order = i WHERE id = r.id;
                    i := i + 1;
                END LOOP;
            END $$;
        `);
        
        // Ensure no param group duplicates just in case
        await client.query(`
            DO $$
            DECLARE
                r RECORD;
                i INT := 1;
            BEGIN
                FOR r IN (
                    SELECT parameter_id, group_id FROM group_parameters ORDER BY sort_order
                ) LOOP
                    UPDATE group_parameters SET sort_order = i WHERE parameter_id = r.parameter_id AND group_id = r.group_id;
                    i := i + 1;
                END LOOP;
            END $$;
        `);
        
        // Apply constraints
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_flowsheets_sort_order ON observation_flowsheets(sort_order) WHERE is_active = true;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_sort_order ON observation_groups(sort_order);
            CREATE UNIQUE INDEX IF NOT EXISTS uq_group_parameters_sort_order ON group_parameters(group_id, sort_order);
        `);
        console.log("Applied constraints to sahty_global!");
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error:", e);
    } finally {
        client.release();
        process.exit(0);
    }
}
run();
