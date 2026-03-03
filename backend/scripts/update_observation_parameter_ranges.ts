import { getGlobalPool } from '../db/globalPg';

export const updateParameterRanges = async () => {
    const pool = getGlobalPool();
    const client = await pool.connect();

    try {
        console.log("Starting update of observation parameter ranges...");
        await client.query('BEGIN');

        const updates = [
            // 🫀 Vitals & Hemodynamics
            { code: 'FC', hmin: 20, wmin: 40, nmin: 60, nmax: 100, wmax: 130, hmax: 250 },
            { code: 'PA_SYS', hmin: 40, wmin: 80, nmin: 100, nmax: 140, wmax: 180, hmax: 300 },
            { code: 'PA_DIA', hmin: 20, wmin: 40, nmin: 60, nmax: 90, wmax: 120, hmax: 200 },
            { code: 'PAP', hmin: 5, wmin: 8, nmin: 10, nmax: 20, wmax: 30, hmax: 60 },
            { code: 'PVC', hmin: 0, wmin: 1, nmin: 2, nmax: 8, wmax: 15, hmax: 30 }, // Code might also be POD, I'll update both
            { code: 'POD', hmin: 0, wmin: 1, nmin: 2, nmax: 8, wmax: 15, hmax: 30 },
            { code: 'PCP', hmin: 0, wmin: 4, nmin: 6, nmax: 12, wmax: 20, hmax: 40 },
            { code: 'PAI', hmin: 0, wmin: 3, nmin: 5, nmax: 20, wmax: 35, hmax: 60 },

            // 🫁 Respiratory
            { code: 'FR', hmin: 4, wmin: 8, nmin: 12, nmax: 20, wmax: 35, hmax: 80 },
            { code: 'VT', hmin: 100, wmin: 250, nmin: 400, nmax: 600, wmax: 800, hmax: 1500 },
            { code: 'PEEP', hmin: 0, wmin: 3, nmin: 5, nmax: 10, wmax: 20, hmax: 30 },
            { code: 'PINS', hmin: 0, wmin: 8, nmin: 10, nmax: 25, wmax: 40, hmax: 60 },
            { code: 'SPO2', hmin: 50, wmin: 88, nmin: 95, nmax: 100, wmax: 100, hmax: 100 },
            { code: 'SAO2_GAZ', hmin: 50, wmin: 88, nmin: 95, nmax: 100, wmax: 100, hmax: 100 }, // Was SAO2
            { code: 'SVO2', hmin: 30, wmin: 55, nmin: 65, nmax: 75, wmax: 80, hmax: 90 },
            { code: 'FIO2', hmin: 21, wmin: 40, nmin: 21, nmax: 40, wmax: 80, hmax: 100 },

            // 🧪 Blood gases & Labs
            { code: 'PH', hmin: 6.8, wmin: 7.25, nmin: 7.35, nmax: 7.45, wmax: 7.55, hmax: 7.8 },
            { code: 'PO2', hmin: 20, wmin: 60, nmin: 80, nmax: 100, wmax: 200, hmax: 500 },
            { code: 'PCO2', hmin: 10, wmin: 25, nmin: 35, nmax: 45, wmax: 60, hmax: 120 },
            { code: 'HCO3', hmin: 5, wmin: 15, nmin: 22, nmax: 26, wmax: 35, hmax: 50 },
            { code: 'K', hmin: 1.5, wmin: 3.0, nmin: 3.5, nmax: 5.0, wmax: 5.5, hmax: 8.0 },
            { code: 'LACTATE', hmin: 0.2, wmin: 2.0, nmin: 0.5, nmax: 2.0, wmax: 5.0, hmax: 20 },
            { code: 'GLYC', hmin: 0.2, wmin: 0.5, nmin: 0.7, nmax: 1.1, wmax: 2.5, hmax: 6.0 }, // Was GLYCEMIE

            // 🌡 Temperature
            { code: 'TEMP', hmin: 30, wmin: 35, nmin: 36.5, nmax: 37.5, wmax: 39, hmax: 43 },

            // 🧠 Neuro
            { code: 'GLASGOW', hmin: 3, wmin: 9, nmin: 15, nmax: 15, wmax: 14, hmax: 15 },
            { code: 'EVA', hmin: 0, wmin: 4, nmin: 0, nmax: 3, wmax: 7, hmax: 10 },

            // 💧 Outputs / Inputs (per hour or per entry)
            { code: 'DIURESE_QTY', hmin: 0, wmin: 10, nmin: 30, nmax: 200, wmax: 400, hmax: 2000 },
            { code: 'DRAIN_1_QTY', hmin: 0, wmin: 100, nmin: 0, nmax: 100, wmax: 500, hmax: 2000 },
            { code: 'REDON_1_QTY', hmin: 0, wmin: 100, nmin: 0, nmax: 100, wmax: 500, hmax: 2000 }, // Was REDON_QTY
            { code: 'RESIDU', hmin: 0, wmin: 200, nmin: 0, nmax: 200, wmax: 1000, hmax: 3000 },
            { code: 'VOMIS', hmin: 0, wmin: 200, nmin: 0, nmax: 200, wmax: 1000, hmax: 3000 },
            { code: 'APPORTS_TOTAL', hmin: 0, wmin: 500, nmin: 1500, nmax: 3000, wmax: 6000, hmax: 15000 }
        ];

        for (const u of updates) {
            const res = await client.query(`
                UPDATE observation_parameters
                SET hard_min = $1, warning_min = $2, normal_min = $3,
                    normal_max = $4, warning_max = $5, hard_max = $6
                WHERE code = $7
                RETURNING id;
            `, [u.hmin, u.wmin, u.nmin, u.nmax, u.wmax, u.hmax, u.code]);
            
            if (res.rowCount === 0) {
                console.log(`⚠️  Parameter with code '${u.code}' not found or no rows updated.`);
            } else {
                console.log(`✅ Updated parameter '${u.code}'`);
            }
        }

        await client.query('COMMIT');
        console.log("Successfully updated all parameter ranges.");

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error updating ranges, rolled back:", error);
    } finally {
        client.release();
    }
};

updateParameterRanges().then(() => process.exit(0)).catch(console.error);
