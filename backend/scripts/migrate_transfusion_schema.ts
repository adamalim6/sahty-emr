import { Pool } from 'pg';

const sql = `
-- 1. Add volume_administered_ml to the mapping table
ALTER TABLE public.administration_event_blood_bags
ADD COLUMN IF NOT EXISTS volume_administered_ml numeric;

-- 2. Create Safety Checks Table
CREATE TABLE IF NOT EXISTS public.transfusion_checks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    administration_event_id uuid NOT NULL REFERENCES public.administration_events(id) ON DELETE CASCADE,
    checked_by_user_id uuid,
    identity_check_done boolean DEFAULT false,
    compatibility_check_done boolean DEFAULT false,
    bedside_double_check_done boolean DEFAULT false,
    vitals_baseline_done boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Create Reaction Table
CREATE TABLE IF NOT EXISTS public.transfusion_reactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    administration_event_id uuid NOT NULL REFERENCES public.administration_events(id) ON DELETE CASCADE,
    recorded_by_user_id uuid,
    reaction_type varchar(50) NOT NULL,
    severity varchar(50),
    description text,
    actions_taken text,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Create Pause Table
CREATE TABLE IF NOT EXISTS public.administration_event_pauses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    administration_event_id uuid NOT NULL REFERENCES public.administration_events(id) ON DELETE CASCADE,
    paused_at timestamp with time zone NOT NULL,
    resumed_at timestamp with time zone,
    paused_by_user_id uuid,
    resumed_by_user_id uuid,
    pause_reason text,
    created_at timestamp with time zone DEFAULT now()
);
`;

async function run() {
    const adminPool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database:'postgres' });
    
    try {
        const res = await adminPool.query("SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'");
        console.log(`Found ${res.rows.length} tenant DBs`);
        
        for (const row of res.rows) {
            const dbName = row.datname;
            console.log(`Processing ${dbName}...`);
            const pool = new Pool({ host:'localhost', port:5432, user:'sahty', password:'sahty_dev_2026', database: dbName });
            try {
                await pool.query(sql);
                console.log(`✅ ${dbName}: migration Transfusion 2.0 applied`);
            } catch (err: any) {
                console.error(`❌ ${dbName}: ${err.message}`);
            } finally {
                await pool.end();
            }
        }
    } catch (err: any) {
        console.error("Global Error:", err);
    } finally {
        await adminPool.end();
        process.exit(0);
    }
}

run();
