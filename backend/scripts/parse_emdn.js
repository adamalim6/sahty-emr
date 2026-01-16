const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const INPUT_FILE = path.join(__dirname, '../imports/emdn.rdf');
const OUTPUT_FILE = path.join(__dirname, '../data/global/emdn_tree.json');

// Ensure output directory exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Reading EMDN RDF file...');
const xmlData = fs.readFileSync(INPUT_FILE, 'utf8');

console.log('Parsing XML...');
const dom = new JSDOM(xmlData, { contentType: 'text/xml' });
const doc = dom.window.document;

const descriptions = doc.getElementsByTagName('rdf:Description');
console.log(`Found ${descriptions.length} entries.`);

const nodes = {};

// 1. First Pass: Create Nodes
for (let i = 0; i < descriptions.length; i++) {
    const desc = descriptions[i];
    
    // Extract Code (skos:notation)
    const notificationEl = desc.getElementsByTagName('skos:notation')[0];
    if (!notificationEl) continue;
    const code = notificationEl.textContent.trim();

    // Extract Labels (rdfs:label)
    let label_fr = code;
    let label_en = code;
    
    const labels = desc.getElementsByTagName('rdfs:label');
    for (let j = 0; j < labels.length; j++) {
        const lang = labels[j].getAttribute('xml:lang');
        if (lang === 'fr') label_fr = labels[j].textContent.trim();
        if (lang === 'en') label_en = labels[j].textContent.trim();
    }

    // Extract Level (dc:type)
    const typeEl = desc.getElementsByTagName('dc:type')[0];
    let level = 0;
    if (typeEl) {
        const typeText = typeEl.textContent.trim();
        if (typeText.includes('CATEGORY')) {
            level = 1;
        } else if (typeText.includes('GROUP')) {
            level = 2;
        } else {
            const match = typeText.match(/Level (\d+)/);
            if (match) {
                level = 2 + parseInt(match[1]);
            }
        }
    }

    // Extract Parent (rdfs:subClassOf)
    const subClassOf = desc.getElementsByTagName('rdfs:subClassOf')[0];
    let parentCode = null;
    if (subClassOf) {
        const resource = subClassOf.getAttribute('rdf:resource');
        // Resource URL format: http://data.esante.gouv.fr/ec/emdn/CODE
        parentCode = resource ? resource.split('/').pop() : null;
    }

    nodes[code] = {
        code,
        label_fr,
        label_en,
        level,
        parentCode,
        children: []
    };
}

// 2. Second Pass: Build Tree
const tree = [];
const orphanNodes = [];

Object.values(nodes).forEach(node => {
    if (node.parentCode && nodes[node.parentCode]) {
        nodes[node.parentCode].children.push(node);
    } else {
        // Roots or orphans
        // Level 1 nodes are roots (Categories)
        if (node.level === 1) {
            tree.push(node);
        } else {
            orphanNodes.push(node);
        }
    }
});

// Sort children by code
const sortNodes = (nodeList) => {
    nodeList.sort((a, b) => a.code.localeCompare(b.code));
    nodeList.forEach(node => {
        if (node.children.length > 0) {
            sortNodes(node.children);
        }
    });
};
sortNodes(tree);

console.log(`Tree built. ${tree.length} root nodes.`);
console.log(`${orphanNodes.length} orphan nodes ignored (usually references to non-existent parents or external roots).`);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tree, null, 2));
console.log(`EMDN Tree saved to ${OUTPUT_FILE}`);
