
import fs from 'fs';
import path from 'path';

// Let's use Regex for this strict format to avoid heavy dependencies, 
// as the file is regular and we control the environment.
// Format:
// <rdf:Description rdf:about=".../atc/CODE">
//   <rdfs:label xml:lang="fr">LABEL</rdfs:label>
//   <rdfs:label xml:lang="en">LABEL</rdfs:label>
//   <rdfs:subClassOf rdf:resource=".../atc/PARENT_CODE"/>
//   <dc:type>LEVEL</dc:type>
//   <skos:notation>CODE</skos:notation>
// </rdf:Description>

interface ATCNode {
    code: string;
    label_fr: string;
    label_en: string;
    level: number;
    parent: string | null;
    children: ATCNode[];
}

const rdfPath = path.join(__dirname, '../data/global/atc_codes.rdf');
const outPath = path.join(__dirname, '../data/global/atc_tree.json');

const rdfContent = fs.readFileSync(rdfPath, 'utf-8');

// Regex blocks
const blockRegex = /<rdf:Description rdf:about="(.*?)">([\s\S]*?)<\/rdf:Description>/g;
const notationRegex = /<skos:notation>(.*?)<\/skos:notation>/;
const labelFrRegex = /<rdfs:label xml:lang="fr">(.*?)<\/rdfs:label>/;
const labelEnRegex = /<rdfs:label xml:lang="en">(.*?)<\/rdfs:label>/;
const typeRegex = /<dc:type>(.*?)<\/dc:type>/;
const subClassRegex = /<rdfs:subClassOf rdf:resource=".*?\/atc\/(.*?)"\/>/;

const nodes: Record<string, ATCNode> = {};
const rawList: ATCNode[] = [];

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

    const node: ATCNode = {
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
const tree: ATCNode[] = [];
let attachedCount = 0;

rawList.forEach(node => {
    if (node.parent && nodes[node.parent]) {
        nodes[node.parent].children.push(node);
        attachedCount++;
    } else {
        // Roots (Level 1 usually, or broken parents)
        if (node.level === 1) {
            tree.push(node);
        } else {
            console.warn(`Orphan node: ${node.code} (Level ${node.level}, Parent ${node.parent})`);
        }
    }
});

console.log(`Built tree with ${tree.length} roots and ${attachedCount} children.`);

// Sort children by code
const sortNodes = (n: ATCNode) => {
    n.children.sort((a, b) => a.code.localeCompare(b.code));
    n.children.forEach(sortNodes);
};
tree.sort((a, b) => a.code.localeCompare(b.code));
tree.forEach(sortNodes);

fs.writeFileSync(outPath, JSON.stringify(tree, null, 2));
console.log(`Wrote tree to ${outPath}`);
