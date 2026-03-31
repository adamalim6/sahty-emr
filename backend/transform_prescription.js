const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'services', 'prescriptionService.ts');
let content = fs.readFileSync(targetPath, 'utf8');

// Find logAdministrationAction and clone it as logAdministrationActionTx
const match = content.match(/async logAdministrationAction\([\s\S]*?return this\.getEventById\(tenantId, row.id\);\n    \}/);

if (match) {
    let cloned = match[0];
    cloned = cloned.replace('async logAdministrationAction(', 'async logAdministrationActionTx(\n        tenantId: string,\n        client: any,\n        prescriptionEventId: string,');
    
    // Remove tenantId from original signature
    cloned = cloned.replace('tenantId: string,\n        prescriptionEventId: string,', 'prescriptionEventId: string,');
    
    // Replace all tenantQuery with client.query
    cloned = cloned.replace(/await tenantQuery<.*?>\(tenantId,([\s\S]*?)\);/g, "await client.query($1).then((res: any) => res.rows);");
    cloned = cloned.replace(/await tenantQuery\(tenantId,([\s\S]*?)\);/g, "await client.query($1);");
    
    // Replace internal transaction logic
    cloned = cloned.replace(/const client = await getTenantClient\(tenantId\);\n\s+let row;\n\s+try \{\n\s+await client.query\('BEGIN'\);([\s\S]*?)await client.query\('COMMIT'\);\n\s+\} catch \((.*?)\) \{\n\s+await client.query\('ROLLBACK'\);\n\s+throw (.*?);\n\s+\} finally \{\n\s+client.release\(\);\n\s+\}/, "let row;\n        $1");
    // Also remove the catch/finally if it exists

    cloned = cloned.replace("const res = await client.query(query, [", "const res = await client.query(query, [\n");

    const insertIndex = content.indexOf('async logAdministrationAction(');
    content = content.slice(0, insertIndex) + cloned + '\n\n    ' + content.slice(insertIndex);
    
    fs.writeFileSync(targetPath, content);
    console.log("Successfully added logAdministrationActionTx");
} else {
    console.log("Failed to match function");
}
