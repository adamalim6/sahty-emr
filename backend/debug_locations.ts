import { tenantQuery } from './db/tenantPg';

const TENANT_ID = '36dff8fa-4729-4c10-a0bf-712be63cc9b2';

async function run() {
    try {
        const locs = await tenantQuery(TENANT_ID, `SELECT location_id as id, name, type, scope, location_class, valuation_policy, status FROM locations WHERE status = 'ACTIVE'`);
        console.log('All Active Locations:', JSON.stringify(locs, null, 2));
        
        // Commercial check
        const commercial = locs.filter((l: any) => 
            l.scope === 'PHARMACY' && l.status === 'ACTIVE' && 
            l.location_class === 'COMMERCIAL' && l.valuation_policy === 'VALUABLE'
        );
        console.log('\nCommercial (Pharmacy, COMMERCIAL, VALUABLE):', commercial.length);
        
        // Charity check
        const charity = locs.filter((l: any) => 
            l.scope === 'PHARMACY' && l.status === 'ACTIVE' && 
            l.location_class === 'CHARITY'
        );
        console.log('Charity:', charity.length);
        
        process.exit(0);
    } catch (e: any) {
        console.error(e);
        process.exit(1);
    }
}

run();
