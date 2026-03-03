import * as xlsx from 'xlsx';
import { getGlobalPool } from '../db/globalPg';
import * as path from 'path';
import * as fs from 'fs';

const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000001';

function parseDelai(val: string): number | null {
    if (!val) return null;
    const match = val.toString().match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}

function parseBoolean(val: string): boolean {
    if (!val) return false;
    return val.toString().trim().toUpperCase() === 'OUI';
}

function parseIntSafe(val: any): number | null {
    if (!val) return null;
    const parsed = parseInt(val.toString(), 10);
    return isNaN(parsed) ? null : parsed;
}

async function runImport() {
    console.log('--- Starting Biology Catalog Import ---');
    const filePath = '/Users/adamalim/Desktop/EXPORT_ANALYSES20250712 (1).xls';
    
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Find headers
    let headerRowIndex = -1;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row && (row.includes('Code') || row.includes('Discipline'))) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex === -1) {
        console.error("Could not find header row.");
        process.exit(1);
    }

    const rows = data.slice(headerRowIndex + 1).filter(r => r && r[2]); // Assuming Code is at index 2
    
    console.log(`Found ${rows.length} acts to process.`);

    const pool = getGlobalPool();
    const client = await pool.connect();
    
    const report = {
        total_rows: rows.length,
        inserted: 0,
        updated: 0,
        skipped_wrong_type: 0,
        errors: 0,
        sub_families_created: 0,
        details: [] as string[]
    };

    try {
        await client.query(`SET LOCAL app.user_id = '${SYSTEM_ACTOR}'`);
        await client.query('BEGIN');

        // 1. Get BIOLOGIE Family ID
        const famRes = await client.query(`SELECT id FROM public.sih_familles WHERE code = 'BIOLOGIE'`);
        if (famRes.rows.length === 0) {
            throw new Error("BIOLOGIE family not found in db.");
        }
        const familleId = famRes.rows[0].id;

        // 2. Cache / Create Sub-families
        const subFamMap = new Map<string, string>(); // code -> id
        const existingSubFams = await client.query(`SELECT id, code FROM public.sih_sous_familles WHERE famille_id = $1`, [familleId]);
        for (const sf of existingSubFams.rows) {
            subFamMap.set(sf.code.toUpperCase(), sf.id);
        }

        // Process rows
        for (const row of rows) {
            const discipline = row[0]?.toString().trim();
            const libelle = row[1]?.toString().trim();
            const codeSih = row[2]?.toString().trim();
            const grise = parseBoolean(row[3]);
            const grisePresc = parseBoolean(row[4]);
            const delai = parseDelai(row[5]);
            const cle = row[6]?.toString().trim() || null;
            const b = parseIntSafe(row[7]);
            const b1 = parseIntSafe(row[8]);
            const b2 = parseIntSafe(row[9]);
            const b3 = parseIntSafe(row[10]);
            const b4 = parseIntSafe(row[11]);
            const instructions = row[12]?.toString().trim() || null;
            const commentaire = row[13]?.toString().trim() || null;
            const commentairePresc = row[14]?.toString().trim() || null;

            if (!codeSih || !libelle || !discipline) {
                report.errors++;
                report.details.push(`Skipped row missing core fields: ${row.join(' | ')}`);
                continue;
            }

            // Ensure Sub-Family
            let sousFamilleId = subFamMap.get(discipline.toUpperCase());
            if (!sousFamilleId) {
                const subFamRes = await client.query(`
                    INSERT INTO public.sih_sous_familles (famille_id, code, libelle)
                    VALUES ($1, $2, $3) RETURNING id
                `, [familleId, discipline.substring(0, 50).toUpperCase(), discipline]);
                sousFamilleId = subFamRes.rows[0].id as string;
                subFamMap.set(discipline.toUpperCase(), sousFamilleId);
                report.sub_families_created++;
            }

            // Check if acte exists
            const existingRes = await client.query(`SELECT id, type_acte FROM public.global_actes WHERE code_sih = $1`, [codeSih]);
            
            if (existingRes.rows.length > 0) {
                const existing = existingRes.rows[0];
                // if code_sih exists:
                // If type ≠ BIOLOGY → skip + report
                if (existing.type_acte && existing.type_acte !== 'BIOLOGY') {
                    report.skipped_wrong_type++;
                    report.details.push(`Skipped ${codeSih}: existing type is ${existing.type_acte}`);
                    continue;
                }

                // Update
                await client.query(`
                    UPDATE public.global_actes SET
                        libelle_sih = $2,
                        famille_id = $3,
                        sous_famille_id = $4,
                        type_acte = 'BIOLOGY',
                        actif = true,
                        bio_grise = $5,
                        bio_grise_prescription = $6,
                        bio_delai_resultats_heures = $7,
                        bio_cle_facturation = $8,
                        bio_nombre_b = $9,
                        bio_nombre_b1 = $10,
                        bio_nombre_b2 = $11,
                        bio_nombre_b3 = $12,
                        bio_nombre_b4 = $13,
                        bio_instructions_prelevement = $14,
                        bio_commentaire = $15,
                        bio_commentaire_prescription = $16,
                        is_lims_enabled = true
                    WHERE code_sih = $1
                `, [
                    codeSih, libelle, familleId, sousFamilleId,
                    grise, grisePresc, delai, cle,
                    b, b1, b2, b3, b4,
                    instructions, commentaire, commentairePresc
                ]);
                report.updated++;
            } else {
                // Insert
                await client.query(`
                    INSERT INTO public.global_actes (
                        code_sih, libelle_sih, famille_id, sous_famille_id, type_acte, actif,
                        bio_grise, bio_grise_prescription, bio_delai_resultats_heures,
                        bio_cle_facturation, bio_nombre_b, bio_nombre_b1, bio_nombre_b2,
                        bio_nombre_b3, bio_nombre_b4, bio_instructions_prelevement,
                        bio_commentaire, bio_commentaire_prescription, is_lims_enabled
                    ) VALUES (
                        $1, $2, $3, $4, 'BIOLOGY', true,
                        $5, $6, $7,
                        $8, $9, $10, $11,
                        $12, $13, $14,
                        $15, $16, true
                    )
                `, [
                    codeSih, libelle, familleId, sousFamilleId,
                    grise, grisePresc, delai,
                    cle, b, b1, b2,
                    b3, b4, instructions,
                    commentaire, commentairePresc
                ]);
                report.inserted++;
            }
        }

        await client.query('COMMIT');
        
        const reportPath = path.join(__dirname, 'import_biology_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`✅ Import finished. Report saved to ${reportPath}`);
        console.log(`Inserted: ${report.inserted}, Updated: ${report.updated}, SubFamilies: ${report.sub_families_created}, Skipped: ${report.skipped_wrong_type}`);
        
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Import Failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

runImport().catch(console.error);
