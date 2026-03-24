import { getGlobalPool } from '../db/globalPg';
import { v4 as uuidv4 } from 'uuid';

const missingParams = [
  // Neuro
  { code: 'AGITATION', label: 'Agitation', type: 'boolean' },
  { code: 'CONFUSION', label: 'Confusion', type: 'boolean' },
  // Respiratoire
  { code: 'ENCOMBREMENT', label: 'Encombrement bronchique', type: 'boolean' },
  { code: 'TOUX', label: 'Toux', type: 'boolean' },
  { code: 'DYSPNEE', label: 'Dyspnée', type: 'boolean' },
  { code: 'CYANOSE', label: 'Cyanose', type: 'boolean' },
  // Cardio / Peripherique
  { code: 'MARBRURES', label: 'Marbrures', type: 'boolean' },
  { code: 'EXTREMITES_FROIDES', label: 'Extrémités froides', type: 'boolean' },
  { code: 'TRC_ALLONGE', label: 'TRC allongé', type: 'boolean' },
  { code: 'OEDEMES', label: 'Œdèmes', type: 'boolean' },
  // Digestif
  { code: 'VOMISSEMENTS', label: 'Vomissements', type: 'boolean' },
  { code: 'DIARRHEE', label: 'Diarrhée', type: 'boolean' },
  { code: 'CONSTIPATION', label: 'Constipation', type: 'boolean' },
  { code: 'BALLONNEMENT', label: 'Ballonnement abdominal', type: 'boolean' },
  { code: 'DOULEUR_ABDOMINALE', label: 'Douleur abdominale', type: 'boolean' },
  // Cutané
  { code: 'PALEUR', label: 'Pâleur', type: 'boolean' },
  { code: 'ICTERE', label: 'Ictère', type: 'boolean' },
  { code: 'SUEURS', label: 'Sueurs', type: 'boolean' },
  { code: 'DESHYDRATATION_CLINIQUE', label: 'Déshydratation clinique', type: 'boolean' },
  { code: 'ASTHENIE', label: 'Asthénie', type: 'boolean' },
];

async function run() {
  const globalPool = getGlobalPool();
  try {
    console.log("Updating GLASGOW and EVA units to NULL...");
    await globalPool.query(`
      UPDATE public.observation_parameters 
      SET unit = NULL 
      WHERE code IN ('GLASGOW', 'EVA');
    `);

    console.log("Inserting missing parameters...");
    for (const p of missingParams) {
      // Check if it exists
      const exists = await globalPool.query('SELECT id FROM public.observation_parameters WHERE code = $1', [p.code]);
      if (exists.rowCount === 0) {
        await globalPool.query(`
          INSERT INTO public.observation_parameters (id, code, label, value_type, is_active, source, created_at, updated_at)
          VALUES ($1, $2, $3, $4, true, 'manual', NOW(), NOW())
        `, [uuidv4(), p.code, p.label, p.type]);
        console.log(`Inserted ${p.code}`);
      } else {
        console.log(`Skipped ${p.code} (already exists)`);
      }
    }

    console.log("Done updating sahty_global.public.observation_parameters.");
  } catch (e) {
    console.error(e);
  } finally {
    await globalPool.end();
  }
}

run();
