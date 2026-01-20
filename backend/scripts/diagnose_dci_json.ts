
import { getGlobalDB } from '../db/globalDb';

const run = async () => {
    const db = await getGlobalDB();
    
    console.log("Checking DCI Synonyms JSON validity...");
    
    db.each("SELECT id, name, synonyms FROM global_dci", (err, row: any) => {
        if (err) {
            console.error("DB Error:", err);
            return;
        }
        if (row.synonyms) {
            try {
                JSON.parse(row.synonyms);
            } catch (e) {
                console.error(`❌ BAD JSON in DCI ${row.id} (${row.name}):`, row.synonyms);
            }
        }
    }, (err, count) => {
        console.log(`Finished checking ${count} rows.`);
    });
};

run().catch(console.error);
