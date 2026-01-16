const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const atcPath = path.join(__dirname, '../data/global/atc_tree.json');
const dciPath = path.join(__dirname, '../data/global/dci.json');

if (!fs.existsSync(atcPath)) {
    console.error('ATC Tree not found');
    process.exit(1);
}

const atcTree = JSON.parse(fs.readFileSync(atcPath, 'utf8'));
const dciList = [];

function traverse(nodes, lineage) {
    nodes.forEach(node => {
        // Clone lineage to avoid reference issues
        const currentLineage = [...lineage];

        // We only care about levels 2, 3, and 4 for the hereditary classification
        if (node.level >= 2 && node.level <= 4) {
            const label = node.label_fr || node.label_en || node.code;
            currentLineage.push(label);
        }

        if (node.level === 5) {
            // This is a molecule
            const name = node.label_fr || node.label_en || `Molecule ${node.code}`;
            
            // Construct therapeutic class from lineage (Level 2 > Level 3 > Level 4)
            // Reverse order? User said "levels 4 to 2".
            // usually hierarchy is Parent > Child. "4 to 2" might mean "Level 2 > Level 3 > Level 4".
            // Let's assume standard hierarchical path: Level 2 / Level 3 / Level 4
            const therapeuticClass = currentLineage.join(' > ');

            const dci = {
                id: uuidv4(),
                name: name,
                atc_code: node.code,
                therapeutic_class: therapeuticClass,
                synonyms: []
            };
            dciList.push(dci);
        }

        if (node.children && node.children.length > 0) {
            traverse(node.children, currentLineage);
        }
    });
}

console.log('Traversing ATC Tree...');
// Start traversal with empty lineage. 
// Note: We skip Level 1 details in the lineage array inside the function logic.
traverse(atcTree, []);

console.log(`Found ${dciList.length} molecules.`);

fs.writeFileSync(dciPath, JSON.stringify(dciList, null, 2));
console.log(`Populated DCI registry at ${dciPath}`);
