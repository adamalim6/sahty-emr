import { tenantTransaction } from '../db/tenantPg';
import { globalQuery } from '../db/globalPg';

async function runMigration() {
    try {
        console.log("Applying Migration 022: patient_diagnoses (ICD-11)");

        // SQL to apply
        const migrationSql = `
            -- 1. Create Patient Diagnoses table in the public tenant schema
            CREATE TABLE IF NOT EXISTS public.patient_diagnoses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id UUID NOT NULL REFERENCES public.patients_tenant(tenant_patient_id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'VOIDED')),
                clinician_user_id UUID,
                entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                resolved_at TIMESTAMPTZ,
                voided_at TIMESTAMPTZ,
                void_reason TEXT,
                
                -- ICD Fields (WHO Recommended structure)
                icd_linearization TEXT NOT NULL DEFAULT 'mms',
                icd_language TEXT NOT NULL DEFAULT 'fr',
                icd_code TEXT,
                icd_title TEXT,
                icd_selected_text TEXT NOT NULL,
                icd_foundation_uri TEXT NOT NULL,
                icd_linearization_uri TEXT,
                icd_minor_version TEXT,
                source_query TEXT,
                ect_instance_no TEXT
            );

            -- Indexes for efficient querying on the medical dossier
            CREATE INDEX IF NOT EXISTS idx_patient_diagnoses_patient_id_entered_at 
                ON public.patient_diagnoses(patient_id, entered_at DESC);
                
            CREATE INDEX IF NOT EXISTS idx_patient_diagnoses_foundation_uri 
                ON public.patient_diagnoses(icd_foundation_uri);
                
            CREATE INDEX IF NOT EXISTS idx_patient_diagnoses_active 
                ON public.patient_diagnoses(patient_id) 
                WHERE status = 'ACTIVE';
        `;

        // 1. Get all SaaS tenants
        const tenants = await globalQuery('SELECT id FROM public.tenants', []);
        
        // 2. Loop and apply the migration transaction to each
        for (const tenant of tenants) {
            const tenantId = tenant.id;
            console.log(`Processing schema creation for tenant: ${tenantId}`);
            
            try {
                await tenantTransaction(tenantId, async (client) => {
                    await client.query(migrationSql);
                });
                console.log(`  - Migration 022 successful for tenant ${tenantId}`);
            } catch (err: any) {
                console.error(`  [!] Failed applying 022 for tenant ${tenantId}: ${err.message}`);
            }
        }
        
    } catch (e: any) {
        console.error("Master script failure:", e);
    }
    
    process.exit(0);
}

runMigration();
