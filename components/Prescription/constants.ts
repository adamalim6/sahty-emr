
import { MoleculeDatabase } from './types';

export const MOLECULE_DB_UNIVERSAL: MoleculeDatabase = {
    "Paracétamol": ["Doliprane", "Panadol", "Tylenol", "Efferalgan"],
    "Paracetamol": ["Doliprane (NA)", "Panadol (NA)", "Tylenol (NA)"], // Ajouté pour faciliter les tests sans accents
    "Ibuprofène": ["Advil", "Nurofen", "Motrin", "Brufen"],
    "Amoxicilline": ["Amoxil", "Clamoxyl", "Trimox"],
    "Metformine": ["Glucophage", "Riomet", "Fortamet"],
    "Cétirizine": ["Zyrtec", "Reactine"],
    "Oméprazole": ["Prilosec", "Losec"],
    "Simvastatine": ["Zocor"],
    "Aspirine": ["Bayer", "Aspro", "Ecotrin"],
    // Solvants ajoutés pour la dilution
    "Glucose": ["Glucose 5%", "Glucose 10%"],
    "Chlorure de sodium": ["NaCl 0.9%", "Sérum physiologique"],
    "Eau pour préparation injectable": ["EPPI"]
};

export const MOLECULE_DB_HOSPITAL: MoleculeDatabase = {
    "Paracétamol": ["Doliprane", "Efferalgan"],
    "Ibuprofène": ["Advil", "Nurofen"],
    "Amoxicilline": ["Amoxil"],
    "Glucose": ["Glucose 5%"],
    "Chlorure de sodium": ["NaCl 0.9%"]
};

export const UNITS = [
    // Existing units
    "mg", "g", "µg", "mL", "comprimés", "gélules", "bouffées", "IV mL/h", "UI",
    
    // Mass / Amount
    "ng", "mmol", "mEq", "mOsm", "IU",
    
    // Volume
    "L", "µL", "gouttes (drops / gtt)",
    
    // Rate / Infusion
    "mg/h", "µg/kg/min", "mg/kg/h", "mL/min", "mL/kg/h", "UI/h", "UI/kg/h",
    
    // Per-weight dosing
    "mg/kg", "µg/kg", "UI/kg", "mmol/kg",
    
    // Per-surface dosing
    "mg/m²", "µg/m²",
    
    // Units / Devices / Discrete forms
    "sachet(s)", "ampoule(s)", "flacon(s)", "poche(s)", "spray(s)", "dose(s)", "application(s)", "patch(s)", "suppositoire(s)", "ovule(s)", "unité(s)",
    
    // Time-based (for perfusions / continuous)
    "mg/min", "mg/kg/min", "UI/min"
];

export const ROUTES = [
    // Existing routes
    "Orale",
    "Intraveineuse (IV)",
    "Intraveineuse directe (IVD)",
    "Intraveineuse lente (IVL)",
    "Sous-cutanée (SC)",
    "Intramusculaire (IM)",
    "Rectale",
    "Nébulisation (Neb)",
    
    // Enteral / Digestive
    "Orale par sonde (SNG / PEG)",
    "Sublinguale",
    "Buccale",
    
    // Parenteral
    "Intra-artérielle (IA)",
    "Intra-osseuse (IO)",
    "Intradermique (ID)",
    "Intrathécale (IT)",
    "Péridurale (EP)",
    "Intraventriculaire",
    
    // Respiratory
    "Inhalation",
    "Oxygénothérapie",
    "Ventilation (aérosol circuit ventilé)",
    
    // Topical / Local
    "Cutanée (topique)",
    "Transdermique (patch)",
    "Ophtalmique (œil)",
    "Otique (oreille)",
    "Nasale",
    "Vaginale",
    "Urétrale",
    
    // Other / Specialized
    "Intra-articulaire",
    "Intrapleurale",
    "Intrapéritonéale",
    "Intratumorale",
    "Locale"
];
