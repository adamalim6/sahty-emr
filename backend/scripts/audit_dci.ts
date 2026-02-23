import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const client = new Client({
         user: 'sahty', host: 'localhost', database: 'sahty_global', password: 'sahty_dev_2026', port: 5432,
    });
    await client.connect();
    
    const res = await client.query(`SELECT id, name, type, dci_composition FROM public.global_products`);
    
    const noDciProducts: string[] = [];
    const missingDosageProducts: string[] = [];

    for (const row of res.rows) {
        let composition: any[];
        if (!row.dci_composition) {
            noDciProducts.push(row.name);
            continue;
        }

        if (typeof row.dci_composition === 'string') {
            try { composition = JSON.parse(row.dci_composition); } catch (e) { continue; }
        } else {
            composition = row.dci_composition;
        }

        if (!Array.isArray(composition) || composition.length === 0) {
            noDciProducts.push(row.name);
            continue;
        }

        let hasMissingDosage = false;
        for (const comp of composition) {
            // Check if amount_value is strictly greater than 0, and amount_unit_id is a valid non-empty string
            const hasAmount = typeof comp.amount_value === 'number' && comp.amount_value > 0;
            const hasUnit = typeof comp.amount_unit_id === 'string' && comp.amount_unit_id.trim().length > 0;
            
            if (!hasAmount || !hasUnit) {
                hasMissingDosage = true;
                break;
            }
        }
        
        if (hasMissingDosage) {
            missingDosageProducts.push(row.name);
        }
    }
    
    let report = `=== AUDIT REPORT ===\n`;
    report += `Total Products Analyzed: ${res.rows.length}\n\n`;
    
    report += `### 1. Products WITHOUT any DCI (${noDciProducts.length})\n`;
    report += noDciProducts.join('\n') + '\n\n';
    
    report += `### 2. Products WITH DCI but missing dosage value or unit (${missingDosageProducts.length})\n`;
    report += missingDosageProducts.join('\n') + '\n\n';

    const reportPath = path.join(process.cwd(), '../', 'dci_audit_report.txt');
    fs.writeFileSync(reportPath, report);
    
    console.log(`Audit complete. Found ${noDciProducts.length} without DCI, and ${missingDosageProducts.length} with incomplete DCIs.`);
    console.log(`Full report saved to: ${reportPath}`);
    
    await client.end();
}
main().catch(console.error);
