import { getGlobalPool } from '../db/globalPg';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';

interface DCIMapping {
  ID: string;
  Name: string;
  'ATC Code': string;
  care_code: string;
  care_category_id: string;
}

async function updateDCICareCategories() {
  const filePath = '/Users/adamalim/Desktop/dci_care_category_mapping.csv';
  console.log(`Reading mapping file from: ${filePath}`);

  const fileContent = fs.readFileSync(filePath, 'utf8');

  parse(fileContent, { columns: true, skip_empty_lines: true }, async (err, records: DCIMapping[]) => {
    if (err) {
      console.error('Error parsing CSV:', err);
      process.exit(1);
    }

    console.log(`Found ${records.length} records. Beginning update...`);
    const pool = getGlobalPool();

    try {
      await pool.query('BEGIN'); // Start transaction

      let successCount = 0;
      let errorCount = 0;

      for (const record of records) {
        if (!record.care_category_id || record.care_category_id.trim() === '') {
            continue; // Skip if no care category ID (although the sample shows all have one)
        }

        try {
          const res = await pool.query(
            `UPDATE global_dci 
             SET care_category_id = $1 
             WHERE id = $2`,
            [record.care_category_id, record.ID]
          );
          
          if (res.rowCount && res.rowCount > 0) {
            successCount++;
          } else {
             console.log(`Warning: DCI not found for ID: ${record.ID}`);
             errorCount++;
          }
          
          if (successCount % 500 === 0) {
             console.log(`Updated ${successCount} DCIs so far...`);
          }

        } catch (dbErr) {
          console.error(`Database error updating DCI ${record.ID}:`, dbErr);
          errorCount++;
        }
      }

      await pool.query('COMMIT');
      console.log(`UPDATE COMPLETE.`);
      console.log(`Successfully updated: ${successCount}`);
      console.log(`Errors/Not found: ${errorCount}`);
      
      process.exit(0);

    } catch (txErr) {
      await pool.query('ROLLBACK');
      console.error('Transaction failed, rolled back.', txErr);
      process.exit(1);
    }
  });
}

updateDCICareCategories();
fron