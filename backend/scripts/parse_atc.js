
const fs = require('fs');
const path = require('path');

// Regex blocks
const blockRegex = /<rdf:Description rdf:about="(.*?)">(.*?)<\/rdf:Description>/gs;
const notationRegex = /<skos:notation>(.*?)<\/skos:notation>/;
const labelFrRegex = /<rdfs:label xml:lang="fr">(.*?)<\/rdfs:label>/;
const labelEnRegex = /<rdfs:label xml:lang="en">(.*?)<\/rdfs:label>/;
const typeRegex = /<dc:type>(.*?)<\/dc:type>/;
const subClassRegex = /<rdfs:subClassOf rdf:resource=".*?\/atc\/(.*?)"\/>/;

const rdfPath = path.join(__dirname, '../data/global/atc_codes.rdf');
const outPath = path.join(__dirname, '../data/global/atc_tree.json');

if (!fs.existsSync(rdfPath)) {
    console.error(`File not found: ${rdfPath}`);
    process.exit(1);
}

const rdfContent = fs.readFileSync(rdfPath, 'utf-8');

const nodes = {};
const rawList = [];

console.log('Parsing RDF...');

let match;
let count = 0;

while ((match = blockRegex.exec(rdfContent)) !== null) {
    const content = match[2];
    
    const notationMatch = content.match(notationRegex);
    const code = notationMatch ? notationMatch[1] : null;

    if (!code) continue;

    const labelFrMatch = content.match(labelFrRegex);
    const labelEnMatch = content.match(labelEnRegex);
    const typeMatch = content.match(typeRegex);
    const subClassMatch = content.match(subClassRegex);

    const node = {
        code: code,
        label_fr: labelFrMatch ? labelFrMatch[1] : '',
        label_en: labelEnMatch ? labelEnMatch[1] : '',
        level: typeMatch ? parseInt(typeMatch[1]) : 0,
        parent: subClassMatch ? subClassMatch[1] : null,
        children: []
    };

    nodes[code] = node;
    rawList.push(node);
    count++;
}

console.log(`Parsed ${count} nodes.`);

// Build Tree
const tree = [];
let attachedCount = 0;

rawList.forEach(node => {
    if (node.parent && nodes[node.parent]) {
        nodes[node.parent].children.push(node);
        attachedCount++;
    } else if (node.code === 'ATC') {
        // Only allow the main ATC node as root
        // This filters out "Concept retirés" and orphan nodes
        tree.push(node);
    }
});

console.log(`Built tree with ${tree.length} roots and ${attachedCount} children.`);

// Sort children by code
const sortNodes = (n) => {
    n.children.sort((a, b) => a.code.localeCompare(b.code));
    n.children.forEach(sortNodes);
};
tree.sort((a, b) => a.code.localeCompare(b.code));
tree.forEach(sortNodes);

fs.writeFileSync(outPath, JSON.stringify(tree, null, 2));
console.log(`Wrote tree to ${outPath}`);
