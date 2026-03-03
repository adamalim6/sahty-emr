import { getGlobalPool } from '../db/globalPg';
import { createObjectCsvWriter } from 'csv-writer';

async function exportDCIs() {
  console.log(`Exporting DCIs to CSV...`);
  const pool = getGlobalPool();

  try {
    const res = await pool.query(`
      SELECT 
          d.id,
          d.name as "dci_name",
          d.atc_code,
          d.therapeutic_class,
          cc.code as "care_category_code",
          cc.label as "care_category_label"
      FROM public.global_dci d
      LEFT JOIN reference.care_categories cc ON d.care_category_id = cc.id
      ORDER BY d.name ASC
    `);

    const records = res.rows;
    console.log(`Fetched ${records.length} records. Writing to CSV...`);

    const csvWriter = createObjectCsvWriter({
      path: '/Users/adamalim/Desktop/dci_export_with_categories.csv',
      header: [
        { id: 'id', title: 'DCI ID' },
        { id: 'dci_name', title: 'Name' },
        { id: 'atc_code', title: 'ATC Code' },
        { id: 'therapeutic_class', title: 'Therapeutic Class' },
        { id: 'care_category_code', title: 'Care Category Code' },
        { id: 'care_category_label', title: 'Care Category Label' }
      ]
    });

    await csvWriter.writeRecords(records);
    console.log('CSV file successfully written to /Users/adamalim/Desktop/dci_export_with_categories.csv');

    process.exit(0);
  } catch (err) {
    console.error('Error exporting DCIs:', err);
    process.exit(1);
  }
}

exportDCIs();
