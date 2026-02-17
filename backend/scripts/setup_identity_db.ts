
import { Client } from 'pg';

async function main() {
    // 1. connect to postgres to create DB
    const adminClient = new Client({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'postgres'
    });

    try {
        await adminClient.connect();
        const dbName = 'sahty_identity';
        
        // Check if DB exists
        const res = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
        if (res.rowCount === 0) {
            console.log(`Creating database ${dbName}...`);
            await adminClient.query(`CREATE DATABASE "${dbName}"`);
        } else {
            console.log(`Database ${dbName} already exists.`);
        }
    } finally {
        await adminClient.end();
    }

    // 2. Connect to new DB and apply schema
    const client = new Client({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        user: process.env.PG_USER || 'sahty',
        password: process.env.PG_PASSWORD || 'sahty_dev_2026',
        database: 'sahty_identity'
    });

    try {
        await client.connect();
        console.log('Connected to sahty_identity.');

        await client.query('CREATE SCHEMA IF NOT EXISTS identity');

        // Note: identity.document_types is EXCLUDED (exists in reference schema)

        // 3. Create Master Patients Table
        console.log('Creating identity.master_patients...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS identity.master_patients (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                dob DATE,
                sex TEXT,
                status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, MERGED, DECEASED, INACTIVE
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_master_patients_name_dob ON identity.master_patients (last_name, first_name, dob);
            CREATE INDEX IF NOT EXISTS idx_master_patients_status ON identity.master_patients (status);
        `);

        // 4. Create Master Patient Documents (NO FK to document_types)
        console.log('Creating identity.master_patient_documents...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS identity.master_patient_documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                master_patient_id UUID NOT NULL REFERENCES identity.master_patients(id) ON DELETE CASCADE,
                document_type_code TEXT NOT NULL, -- No FK to identity.document_types
                document_number TEXT NOT NULL,
                issuing_country_code TEXT,
                is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT uq_document UNIQUE (document_type_code, document_number, issuing_country_code)
            );
            CREATE INDEX IF NOT EXISTS idx_documents_master_patient_id ON identity.master_patient_documents (master_patient_id);
            CREATE INDEX IF NOT EXISTS idx_documents_doc_lookup ON identity.master_patient_documents (document_type_code, document_number);
        `);

        // 5. Create Master Patient Aliases
        console.log('Creating identity.master_patient_aliases...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS identity.master_patient_aliases (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                master_patient_id UUID NOT NULL REFERENCES identity.master_patients(id) ON DELETE CASCADE,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                source TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_aliases_master_patient_id ON identity.master_patient_aliases (master_patient_id);
        `);

        // 6. Create Master Patient Merge Events
        console.log('Creating identity.master_patient_merge_events...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS identity.master_patient_merge_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                survivor_master_patient_id UUID NOT NULL REFERENCES identity.master_patients(id),
                merged_master_patient_id UUID NOT NULL REFERENCES identity.master_patients(id),
                merged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                merged_by TEXT,
                reason TEXT,
                
                CONSTRAINT uq_merged_patient UNIQUE (merged_master_patient_id)
            );
            CREATE INDEX IF NOT EXISTS idx_merge_survivor ON identity.master_patient_merge_events (survivor_master_patient_id);
            CREATE INDEX IF NOT EXISTS idx_merge_merged ON identity.master_patient_merge_events (merged_master_patient_id);
        `);

        console.log('✅ sahty_identity schema applied successfully.');

    } catch (err: any) {
        console.error('Error applying schema:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
