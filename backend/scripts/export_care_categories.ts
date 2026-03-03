import { globalCareCategoryService } from '../services/globalCareCategoryService';
import * as fs from 'fs';
import * as path from 'path';

async function exportCareCategories() {
    try {
        console.log('Fetching all Care Categories...');
        const categories = await globalCareCategoryService.getCategories();
        
        console.log(`Found ${categories.length} Care Categories. Formatting to CSV...`);
        
        // CSV Header
        let csvContent = 'ID,Code,Label,"Is Active","Sort Order"\n';
        
        for (const cat of categories) {
            const id = `"${cat.id}"`;
            const code = `"${(cat.code || '').replace(/"/g, '""')}"`;
            const label = `"${(cat.label || '').replace(/"/g, '""')}"`;
            const isActive = `"${cat.isActive ? 'OUI' : 'NON'}"`;
            const sortOrder = `"${cat.sortOrder !== undefined && cat.sortOrder !== null ? cat.sortOrder : ''}"`;
            
            csvContent += `${id},${code},${label},${isActive},${sortOrder}\n`;
        }
        
        const outputPath = path.resolve(__dirname, '../../care_categories_export.csv');
        // Add BOM for Excel to properly read UTF-8 characters
        fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf8');
        
        console.log(`Successfully exported to: ${outputPath}`);
        process.exit(0);
    } catch (error) {
        console.error('Error exporting Care Categories:', error);
        process.exit(1);
    }
}

exportCareCategories();
