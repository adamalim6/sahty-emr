
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Acte } from '../models/acte';

const ACTES_FILE = path.join(__dirname, '../data/actes.json');

// Helper to load data and map to our internal model
const loadActes = (): Acte[] => {
    console.log(`Loading Actes from: ${ACTES_FILE}`);
    if (!fs.existsSync(ACTES_FILE)) {
        console.error('Actes file not found!');
        return [];
    }
    
    const rawData = JSON.parse(fs.readFileSync(ACTES_FILE, 'utf-8'));
    
    return rawData.map((item: any) => ({
        code: item['Code SIH'],
        label: item['Libellé SIH']?.trim(),
        family: item['Famille SIH'],
        subFamily: item['Sous-famille SIH'],
        ngapCode: item['Code NGAP correspondant'],
        ngapLabel: item['Libellé NGAP correspondant'],
        ngapCoeff: item['Cotation NGAP'],
        ccamCode: item['Code CCAM correspondant'],
        ccamLabel: item['Libellé CCAM correspondant'],
        ccamNature: item['Nature de la correspondance CCAM'],
        ngapNature: item['Nature de la correspondance NGAP'],
        type: item["Type d'acte"],
        duration: parseInt(item['Durée moyenne en minutes']) || 0,
        active: item['Actif'] !== false // Default to true if missing
    }));
};

let cachedActes: Acte[] | null = null;

export const getActes = (req: Request, res: Response) => {
    // Basic caching to avoid re-reading file 2600 times
    if (!cachedActes) {
        cachedActes = loadActes();
    }
    
    // Support basic filtering/search if needed
    const { search, family } = req.query;
    
    let results = cachedActes;
    
    if (family) {
        results = results.filter(a => a.family === family as string);
    }
    
    if (search) {
        const q = (search as string).toLowerCase();
        results = results.filter(a => 
            (a.code && a.code.toLowerCase().includes(q)) || 
            (a.label && a.label.toLowerCase().includes(q))
        );
    }
    
    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedResults = results.slice(startIndex, endIndex);
    
    res.json({
        data: paginatedResults,
        total: results.length,
        page,
        totalPages: Math.ceil(results.length / limit)
    });
};

export const updateActe = (req: Request, res: Response) => {
    const { code } = req.params;
    const updates = req.body;
    
    // Ensure cache is loaded
    if (!cachedActes) {
        cachedActes = loadActes();
    }
    
    const index = cachedActes.findIndex(a => a.code === code);
    if (index === -1) {
        return res.status(404).json({ error: 'Acte not found' });
    }
    
    // Update internal model
    const updatedActe = { ...cachedActes[index], ...updates };
    cachedActes[index] = updatedActe;
    
    // Persist to file (We need to map back to original structure or just save our clean structure?)
    // The requirement implies persistence. Since we converted the structure on load, saving "cachedActes" 
    // directly would overwrite the original file with our internal structure (camelCase).
    // The original file used strict French keys (Code SIH, etc.).
    // To support full round-trip, we should ideally map back to the original format.
    // However, since this is a new feature and we control the data now, saving in our cleaner JSON format 
    // might be better for the future, UNLESS the file is used by other legacy systems.
    // Given "Refonte", I will save in the format that matches our `Acte` model to simplify future reads,
    // BUT I must ensure `loadActes` can read it back. 
    // Actually, `loadActes` expects keys like "Code SIH". 
    // I will Map BACK to the original format to be safe and respect the "Excel-like" structure if the user expects it.
    
    // Let's read the RAW file again to preserve fields we might have ignored?
    // Or just map our internal model back to "Code SIH" style.
    
    // For simplicity and robustness in this "Super Admin" context where we are the source of truth now:
    // I will map back to the keys expected by `loadActes`.
    
    const mapToStorage = (a: Acte) => ({
        "Code SIH": a.code,
        "Libellé SIH": a.label,
        "Famille SIH": a.family,
        "Sous-famille SIH": a.subFamily,
        "Code NGAP correspondant": a.ngapCode,
        "Libellé NGAP correspondant": a.ngapLabel,
        "Cotation NGAP": a.ngapCoeff,
        "Code CCAM correspondant": a.ccamCode,
        "Libellé CCAM correspondant": a.ccamLabel,
        "Type d'acte": a.type,
        "Durée moyenne en minutes": a.duration
        // "Nature de la correspondance NGAP" etc are missing in my Acte model?
        // Wait, user request mentioned "Nature de la correspondance NGAP".
        // My `Acte` model (viewed earlier) had lines 1-14.
        // It DID NOT have "Nature". I should verify if I need to add them to the model first.
    });

    // Actually, to avoid data loss of fields I didn't map, I should:
    // 1. Read the raw file.
    // 2. Update the specific item in the raw array.
    // 3. Write raw array back.
    // 4. Update cache.
    
    const rawData = JSON.parse(fs.readFileSync(ACTES_FILE, 'utf-8'));
    const rawIndex = rawData.findIndex((item: any) => item['Code SIH'] === code);
    
    if (rawIndex !== -1) {
        // Update raw fields based on incoming mapped updates
        const item = rawData[rawIndex];
        if (updates.label !== undefined) item['Libellé SIH'] = updates.label;
        if (updates.family !== undefined) item['Famille SIH'] = updates.family;
        if (updates.subFamily !== undefined) item['Sous-famille SIH'] = updates.subFamily;
        
        if (updates.ngapCode !== undefined) item['Code NGAP correspondant'] = updates.ngapCode;
        if (updates.ngapLabel !== undefined) item['Libellé NGAP correspondant'] = updates.ngapLabel;
        if (updates.ngapCoeff !== undefined) item['Cotation NGAP'] = updates.ngapCoeff;
        if (updates.ngapNature !== undefined) item['Nature de la correspondance NGAP'] = updates.ngapNature;
        
        if (updates.ccamCode !== undefined) item['Code CCAM correspondant'] = updates.ccamCode;
        if (updates.ccamLabel !== undefined) item['Libellé CCAM correspondant'] = updates.ccamLabel;
        if (updates.ccamNature !== undefined) item['Nature de la correspondance CCAM'] = updates.ccamNature;
        
        if (updates.duration !== undefined) item['Durée moyenne en minutes'] = updates.duration;
        if (updates.active !== undefined) item['Actif'] = updates.active;
        
        fs.writeFileSync(ACTES_FILE, JSON.stringify(rawData, null, 2));
    }

    res.json(updatedActe);
};
