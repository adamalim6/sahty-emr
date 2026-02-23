import { getGlobalPool } from '../db/globalPg';
import { v4 as uuidv4 } from 'uuid';

async function mapUnitsToParameters() {
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        console.log("Starting unit mapping for observation parameters...");

        // 1. Get all parameters
        const paramsRes = await client.query('SELECT * FROM observation_parameters');
        const parameters = paramsRes.rows;

        // 2. Get all existing units
        const unitsRes = await client.query('SELECT * FROM units');
        let units = unitsRes.rows;

        console.log(`Found ${parameters.length} parameters and ${units.length} existing units.`);

        let newUnitsCount = 0;
        let updatedParamsCount = 0;

        for (const param of parameters) {
            if (!param.unit) continue; // No legacy unit string
            
            // Clean up the unit string (e.g. lowercase for comparison)
            const unitCode = param.unit.trim();
            
            // Fast match case insensitive
            let matchedUnit = units.find(u => u.code.toLowerCase() === unitCode.toLowerCase() || u.display.toLowerCase() === unitCode.toLowerCase());

            // If unit doesn't exist, create it in the DB
            if (!matchedUnit) {
                console.log(`Unit '${unitCode}' not found. Creating it...`);
                const newId = uuidv4();
                
                // Try to infer UCUM compatibility loosely
                const isUcum = ['mg', 'ml', 'g', 'kg', 'mmhg', 'bpm', '°c', '%', '/10', '/15', 'l/min', 'cmh2o', '/min', '%/l', 'ml/h', 'mmol/l', 'g/l'].includes(unitCode.toLowerCase());
                
                const insertRes = await client.query(`
                    INSERT INTO units (id, code, display, is_ucum, is_active, sort_order)
                    VALUES ($1, $2, $3, $4, true, 100)
                    RETURNING *
                `, [newId, unitCode, unitCode, isUcum]);
                
                matchedUnit = insertRes.rows[0];
                units.push(matchedUnit); // Add to local cache
                newUnitsCount++;
            }

            // Update the parameter with the matched/created unit_id
            if (param.unit_id !== matchedUnit.id) {
                await client.query(`
                    UPDATE observation_parameters
                    SET unit_id = $1
                    WHERE id = $2
                `, [matchedUnit.id, param.id]);
                updatedParamsCount++;
                console.log(`Updated parameter '${param.code}' -> unit_id: ${matchedUnit.id} (${matchedUnit.code})`);
            }
        }

        console.log("--- Mapping Complete ---");
        console.log(`Created ${newUnitsCount} new units.`);
        console.log(`Updated ${updatedParamsCount} parameters.`);

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

mapUnitsToParameters();
