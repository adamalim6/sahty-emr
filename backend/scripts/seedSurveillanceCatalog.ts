import { globalObservationCatalogService } from '../services/globalObservationCatalogService';

const STATIC_SECTIONS: any[] = [
  {
    id: 'vital', title: 'Paramètres Vitaux',
    rows: [
      { id: 'pa_sys', label: 'PA Systolique', unit: 'mmHg', type: 'number' },
      { id: 'pa_dia', label: 'PA Diastolique', unit: 'mmHg', type: 'number' },
      { id: 'fc', label: 'Fréquence Cardiaque', unit: 'bpm', type: 'number' },
      { id: 'temp', label: 'Température', unit: '°C', type: 'number' },
    ]
  },
  {
    id: 'neuro', title: 'État Clinique & Neuro',
    rows: [
      { id: 'spo2', label: 'SpO₂', unit: '%', type: 'number' },
      { id: 'eva', label: 'Douleur (EVA)', unit: '/10', type: 'number' },
      { id: 'ramsay', label: 'Score Ramsay', type: 'select', options: ['1', '2', '3', '4', '5', '6'] },
      { id: 'glasgow', label: 'Score Glasgow', unit: '/15', type: 'number' },
      { id: 'pupilles', label: 'Pupilles', type: 'select', options: ['N/N', 'Myosis', 'Mydriase', 'Aniso'] },
    ]
  },
  {
    id: 'hemo', title: 'Monitorage Hémo. Invasif',
    rows: [
      { id: 'pap', label: 'PAP', unit: 'mmHg', type: 'number' },
      { id: 'pcp', label: 'PCP', unit: 'mmHg', type: 'number' },
      { id: 'pvc', label: 'POD / PVC', unit: 'mmHg', type: 'number' },
      { id: 'dc', label: 'DC / IC', unit: 'L/min', type: 'number' },
      { id: 'svo2', label: 'SvO₂', unit: '%', type: 'number' },
    ]
  },
  {
    id: 'ventilation', title: 'Paramètres Ventilatoires',
    rows: [
      { id: 'mode', label: 'Mode ventilatoire', type: 'select', options: ['VACI', 'VS', 'VSAI', 'PC', 'VC'] },
      { id: 'vt', label: 'Vol. Courant (VT)', unit: 'ml', type: 'number' },
      { id: 'fr', label: 'Fréquence (FR)', unit: '/min', type: 'number' },
      { id: 'pins', label: 'P. Ins', unit: 'cmH2O', type: 'number' },
      { id: 'pai', label: 'PAI', unit: 'cmH2O', type: 'number' },
      { id: 'peep', label: 'PEEP', unit: 'cmH2O', type: 'number' },
      { id: 'fio2', label: 'FiO₂ / O₂', unit: '%/L', type: 'text' },
    ]
  },
  {
    id: 'secretion', title: 'Aspirations Trachéales',
    rows: [
      { id: 'aspi_cote', label: 'Cotation', type: 'select', options: ['0', '1', '2', '3'] },
      { id: 'aspi_aspect', label: 'Aspect Sécrétions', type: 'text' },
    ]
  },
  {
    id: 'drains', title: 'Drains & Redons',
    rows: [
        { id: `drain_1_bullage`, label: `Drain 1 Bullage`, type: 'checkbox' },
        { id: `drain_1_traite`, label: `Drain 1 Traite`, type: 'checkbox' },
        { id: `drain_1_qty`, label: `Drain 1 Quantité`, unit: 'ml/h', type: 'number', isOutput: true },
        { id: `drain_1_chgt`, label: `Drain 1 Changement`, type: 'checkbox' },
        { id: `redon_1_qty`, label: `Redon 1 Quantité`, unit: 'ml/h', type: 'number', isOutput: true },
    ] 
  },
  {
    id: 'diurese', title: 'Diurèse',
    rows: [
      { id: 'diurese_qty', label: 'SU / Miction', unit: 'ml', type: 'number', isOutput: true },
    ]
  },
  {
    id: 'gastrique', title: 'Sonde Gastrique',
    rows: [
      { id: 'aspi_gastrique', label: 'Aspiration Gastrique', unit: 'ml', type: 'number', isOutput: true },
      { id: 'residu', label: 'Résidu Gastrique', unit: 'ml', type: 'number', isOutput: true },
      { id: 'vomis', label: 'Vomis / Selles', unit: 'ml', type: 'text', isOutput: true },
    ]
  },
  {
    id: 'gaz', title: 'Gaz du Sang & Bio',
    rows: [
      { id: 'ph', label: 'pH', type: 'number' },
      { id: 'po2', label: 'PaO₂', unit: 'mmHg', type: 'number' },
      { id: 'pco2', label: 'PaCO₂', unit: 'mmHg', type: 'number' },
      { id: 'hco3', label: 'HCO₃⁻', unit: 'mmol/L', type: 'number' },
      { id: 'sao2_gaz', label: 'SaO₂', unit: '%', type: 'number' },
      { id: 'hb', label: 'Hb / Hte', type: 'text' },
      { id: 'glyc', label: 'Glycémie', unit: 'g/L', type: 'number' },
      { id: 'k', label: 'K⁺', unit: 'mmol/L', type: 'number' },
      { id: 'lactate', label: 'Ac. Lactique', unit: 'mmol/L', type: 'number' },
    ]
  },
  {
    id: 'bilan', title: 'Bilan Hydrique Inputs',
    rows: [
      { id: 'apports_total', label: 'Apports Totaux (Perf/PO)', unit: 'ml', type: 'number', isInput: true },
    ]
  },
  {
    id: 'cutane', title: 'Soins Infirmiers & Cutané',
    rows: [
      { id: 'intubation_fix', label: 'Intubation fixée à :', unit: 'cm', type: 'text' },
      { id: 'ballonnet', label: 'Vérif° ballonnet', type: 'checkbox' },
      { id: 'filtre', label: 'Chgt filtre anti-bact.', type: 'checkbox' },
      { id: 'toilette', label: 'Toilette', type: 'checkbox' },
      { id: 'visage', label: 'Soins Visage', type: 'checkbox' },
      { id: 'rasage', label: 'Rasage', type: 'checkbox' },
      { id: 'soins_sondes', label: 'Soins des sondes', type: 'checkbox' },
    ]
  },
  {
    id: 'divers', title: 'Divers',
    rows: [
      { id: 'tour_secu', label: 'Tour de sécurité', type: 'text' },
      { id: 'environnement', label: 'Environnement', type: 'text' },
      { id: 'contentions', label: 'Tour contentions', type: 'text' },
    ]
  }
];

async function seed() {
    try {
        console.log("Starting observation catalog seed...");
        let sortOrderFs = 0;
        let createdGroups = [];
        
        for (const section of STATIC_SECTIONS) {
            console.log(`Processing group: ${section.title}`);
            const paramIds = [];
            
            let sortOrderParam = 0;
            for (const row of section.rows) {
                console.log(`  Creating param: ${row.label}`);
                const createdParam = await globalObservationCatalogService.createParameter({
                    code: row.id.toUpperCase(),
                    label: row.label,
                    unit: row.unit || undefined,
                    valueType: row.type === 'select' || row.type === 'text' ? 'text' : (row.type === 'checkbox' ? 'boolean' : 'number'),
                    isHydricInput: row.isInput || false,
                    isHydricOutput: row.isOutput || false,
                    sortOrder: sortOrderParam++,
                    isActive: true
                });
                paramIds.push(createdParam.id);
            }
            
            const createdGroup = await globalObservationCatalogService.createGroup({
                code: section.id.toUpperCase(),
                label: section.title,
                sortOrder: sortOrderFs++
            }, paramIds);
            
            createdGroups.push(createdGroup.id);
        }
        
        console.log(`Creating 'REANIMATION' Flowsheet...`);
        await globalObservationCatalogService.createFlowsheet({
            code: 'REA',
            label: 'REANIMATION',
            sortOrder: 0,
            isActive: true
        }, createdGroups);
        
        console.log("Seed completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Seed failed:", error);
        process.exit(1);
    }
}

seed();
