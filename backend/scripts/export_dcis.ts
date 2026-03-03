import { globalDCIService } from '../services/GlobalDCIService';
import { getGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';

async function exportDCIs() {
    try {
        console.log('Fetching all DCIs...');
        const dcis = await globalDCIService.getAllDCIs();
        
        console.log('Fetching Care Categories...');
        const pool = getGlobalPool();
        const careCategoriesRes = await pool.query('SELECT id, label FROM reference.care_categories');
        const careCategoryMap = new Map();
        for (const row of careCategoriesRes.rows) {
            careCategoryMap.set(row.id, row.label);
        }
        
        console.log(`Found ${dcis.length} DCIs. Formatting to CSV...`);
        
        // CSV Header
        let csvContent = 'ID,Name,"ATC Code","Therapeutic Class","Care Category",Synonyms\n';
        
        for (const dci of dcis) {
            const id = `"${dci.id}"`;
            const name = `"${dci.name.replace(/"/g, '""')}"`;
            const atcCode = `"${(dci.atcCode || '').replace(/"/g, '""')}"`;
            const therapeuticClass = `"${(dci.therapeuticClass || '').replace(/"/g, '""')}"`;
            
            const careCategoryId = (dci as Record<string, any>).careCategoryId;
            const careCategoryLabel = careCategoryId ? careCategoryMap.get(careCategoryId) || careCategoryId : '';
            const careCategory = `"${careCategoryLabel.replace(/"/g, '""')}"`;
            
            const synonymsList = dci.synonyms?.map(s => typeof s === 'string' ? s : s.synonym).join(' | ') || '';
            const synonyms = `"${synonymsList.replace(/"/g, '""')}"`;
            
            csvContent += `${id},${name},${atcCode},${therapeuticClass},${careCategory},${synonyms}\n`;
        }
        
        const outputPath = path.resolve(__dirname, '../../dci_catalog_export.csv');
        // Add BOM for Excel to properly read UTF-8 characters like accents
        fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf8');
        
        console.log(`Successfully exported to: ${outputPath}`);
        process.exit(0);
    } catch (error) {
        console.error('Error exporting DCIs:', error);
        process.exit(1);
    }
}

exportDCIs();
