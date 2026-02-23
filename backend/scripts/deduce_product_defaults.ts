import { globalQuery, globalTransaction, closeGlobalPool } from '../db/globalPg';

interface DeductionResult {
    id: string;
    form: string;
    name: string;
    route: string | null;
    unit: string | null;
}

// Helper to deduce logic based on free-text "form" or "nom"
function deduceDefaults(form: string, name: string): { route: string | null, unit: string | null } {
    const text = (form + " " + name).toLowerCase();

    // 1. Ophthalmic
    if (text.includes("collyre") || text.includes("ophtalmique") || text.includes("oeil")) {
        return { route: "Ophtalmique (œil)", unit: "gouttes (drops / gtt)" };
    }

    // 2. Topical / Skin
    if (text.includes("pommade") || text.includes("crème") || text.includes("creme") || text.includes("gel cutané") || text.includes("lotion") || text.includes("dermique")) {
        return { route: "Cutanée (topique)", unit: "application(s)" };
    }

    // 3. Injectables (IV/IM/SC)
    if (text.includes("injectable") || text.includes("iv ") || text.includes(" i.v") || text.includes("intravein") || text.includes("perf")) {
        // Default to IV, ampoule or mL depending on presentation
        let unit = "ampoule(s)";
        if (text.includes("flacon") || text.includes("poche")) unit = "flacon(s)";
        else if (text.includes("seringue")) unit = "unité(s)";
        
        return { route: "Intraveineuse (IV)", unit }; // Default injectable to IV, doctor can change to SC/IM
    }
    
    // Subcutaneous
    if (text.includes("sous cutané") || text.includes("sc") || text.includes("s.c")) {
        return { route: "Sous-cutanée (SC)", unit: "unité(s)" };
    }

    // 4. Inhalers
    if (text.includes("inhalation") || text.includes("aérosol") || text.includes("spray") || text.includes("bouffée") || text.includes("inhal")) {
        return { route: "Inhalation", unit: "bouffées" };
    }

    // 5. Rectal / Vaginal
    if (text.includes("suppositoire") || text.includes("suppo")) {
        return { route: "Rectale", unit: "suppositoire(s)" };
    }
    if (text.includes("ovule") || text.includes("vagin")) {
        return { route: "Vaginale", unit: "ovule(s)" };
    }

    // 6. Oral Liquids
    if (text.includes("sirop") || text.includes("suspension buvable") || text.includes("solution buvable") || text.includes("gouttes buvables")) {
        let unit = "mL";
        if (text.includes("gouttes")) unit = "gouttes (drops / gtt)";
        return { route: "Orale", unit };
    }

    // 7. Oral Solids (Default fallback for most medicines)
    if (text.includes("comprimé") || text.includes("comp.") || text.includes("cp")) {
        return { route: "Orale", unit: "comprimés" };
    }
    if (text.includes("gélule") || text.includes("gelule") || text.includes("capsule")) {
        return { route: "Orale", unit: "gélules" };
    }
    if (text.includes("sachet")) {
        return { route: "Orale", unit: "sachet(s)" };
    }
    
    // Default fallback if we detect nothing explicitly but it's a solid
    if (text.includes("poudre")) {
        return { route: "Orale", unit: "sachet(s)" };
    }

    // If completely unknown, leave null so we don't assume incorrectly
    return { route: null, unit: null };
}

async function main() {
    console.log("Starting Smart Deduction Script for Global Products...");

    // 1. Fetch all medications
    const products = await globalQuery(`SELECT id, name, form FROM global_products WHERE type = 'Médicament'`);
    console.log(`Found ${products.length} medications to analyze.`);

    let deducedCount = 0;
    const batchUpdates: string[] = [];
    const values: string[] = [];

    // 2. Perform Deduction
    for (const prod of products) {
        const formStr = prod.form || "";
        const nameStr = prod.name || "";
        const { route, unit } = deduceDefaults(formStr, nameStr);

        if (route && unit) {
            deducedCount++;
            // Note: We are using a massive CASE WHEN to do this efficiently or we can just loop query
            // Since this is a one-off run with ~4000 items, parallel queries are fine in batches
            batchUpdates.push({ id: prod.id, route, unit } as any);
        }
    }

    console.log(`Successfully deduced ${deducedCount} products ( ${((deducedCount / products.length) * 100).toFixed(1)}% )`);

    // 3. Update Database in Transactions
    if (batchUpdates.length > 0) {
        console.log("Applying updates to sahty_global...");
        await globalTransaction(async (client) => {
            let processed = 0;
            for (const update of batchUpdates as any[]) {
                await client.query(`
                    UPDATE global_products 
                    SET default_presc_route = $1, default_presc_unit = $2 
                    WHERE id = $3
                `, [update.route, update.unit, update.id]);
                
                processed++;
                if (processed % 500 === 0) console.log(`  Updated ${processed} / ${batchUpdates.length}`);
            }
        });
        console.log("Database update complete.");
    }

    await closeGlobalPool();
    process.exit(0);
}

main().catch(console.error);
