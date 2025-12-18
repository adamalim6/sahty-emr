
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

export const UNITS = ["mg", "g", "µg", "mL", "comprimés", "gélules", "bouffées", "IV mL/h", "UI"];

export const ROUTES = [
    "Orale",
    "Intraveineuse (IV)",
    "Intraveineuse directe (IVD)",
    "Intraveineuse lente (IVL)",
    "Sous-cutanée (SC)",
    "Intramusculaire (IM)",
    "Rectale",
    "Nébulisation (Neb)"
];
