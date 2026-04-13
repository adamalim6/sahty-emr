/**
 * Test ORU ingestion: processes the first ready ORU from retour/
 */
import { hprimInboundService } from '../services/integrations/hprim/hprimInboundService';
import { tenantQuery } from '../db/tenantPg';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    const RETOUR_PATH = '/Users/adamalim/sahty_hprim/retour';
    
    const files = fs.readdirSync(RETOUR_PATH);
    const hprFile = files.find(f => f.endsWith('.hpr'));
    
    if (!hprFile) {
        console.log('No ORU files in retour/');
        process.exit(0);
    }
    
    const hprPath = path.join(RETOUR_PATH, hprFile);
    const okPath = path.join(RETOUR_PATH, hprFile.replace(/\.hpr$/i, '.ok'));
    const rawContent = fs.readFileSync(hprPath, 'utf-8');
    
    console.log('Processing ORU:', hprFile);
    
    await hprimInboundService.processOruFile(
        tenantId, hprFile, rawContent, hprPath, okPath
    );
    
    console.log('\n✅ Processing complete!');
    
    // Verify results were created
    const reports = await tenantQuery(tenantId, 
        "SELECT id, report_title, source_type, status FROM patient_lab_reports ORDER BY created_at DESC LIMIT 3"
    );
    console.log('\n=== Recent Lab Reports ===');
    console.table(reports);
    
    const results = await tenantQuery(tenantId, 
        "SELECT raw_analyte_label, numeric_value, raw_unit_text, abnormal_flag, source_line_reference FROM patient_lab_results WHERE source_line_reference LIKE 'OBX-%' ORDER BY created_at DESC LIMIT 10"
    );
    console.log('\n=== HPRIM-ingested Results ===');
    console.table(results);
    
    const messages = await tenantQuery(tenantId, 
        "SELECT direction, message_type, file_name, status FROM lab_hprim_messages ORDER BY created_at DESC LIMIT 5"
    );
    console.log('\n=== HPRIM Messages ===');
    console.table(messages);
    
    process.exit(0);
}
test().catch(e => { console.error('ERROR:', e.message, e.stack); process.exit(1); });
