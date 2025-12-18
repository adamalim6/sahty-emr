import React, { useState, useMemo, useEffect } from 'react';
import { 
  Save, 
  Copy, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  Activity, 
  Wind, 
  Droplet, 
  Thermometer, 
  Brain, 
  Syringe, 
  FlaskConical, 
  Clock,
  LineChart,
  Table,
  PlusCircle,
  Calculator,
  Calendar as CalendarIcon,
  CheckSquare,
  Trash2,
  AlertCircle,
  X
} from 'lucide-react';

// --- Configuration des Heures (08h -> 07h J+1) ---
const START_HOUR = 8;
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = (START_HOUR + i) % 24;
  return h.toString().padStart(2, '0') + 'h';
});

// --- Types de Données ---
type CellValue = string | boolean | number;
type DailyGridData = Record<string, Record<string, CellValue>>; 
type AllData = Record<string, DailyGridData>; 

interface RowConfig {
  id: string;
  label: string;
  unit?: string;
  type: 'number' | 'text' | 'select' | 'checkbox' | 'computed' | 'computed_vertical' | 'section_header';
  options?: string[]; 
  bgColor?: string; 
  computeSource?: string; 
  textColor?: string;
  isInput?: boolean; // For Bilan Hydrique Inputs
  isOutput?: boolean; // For Bilan Hydrique Outputs
  parentId?: string; // For grouping dynamic rows
}

interface SectionConfig {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  rows: RowConfig[];
}

// --- Composant Graphique SVG (Vital Signs) ---
const VitalSignsChart: React.FC<{ data: DailyGridData, hours: string[] }> = ({ data, hours }) => {
  const width = 1200;
  const height = 400; 
  // Increased left padding to accommodate 3 scales (PA, FC, Temp) and spacing
  const padding = { top: 30, bottom: 40, left: 160, right: 30 };
  const chartH = height - padding.top - padding.bottom;
  const chartW = width - padding.left - padding.right;

  // Scales
  const getX = (index: number) => padding.left + (index / (hours.length - 1)) * chartW;
  const getY = (val: number, min: number, max: number) => padding.top + chartH - ((val - min) / (max - min)) * chartH;

  // Data Extraction
  const extractData = (key: string) => hours.map((h, i) => {
    const val = parseFloat(data[key]?.[h] as string);
    return isNaN(val) ? null : { x: getX(i), y: val };
  });

  const sysPoints = extractData('pa_sys');
  const diaPoints = extractData('pa_dia');
  const fcPoints = extractData('fc').map(p => p ? { ...p, y: getY(p.y, 0, 200) } : null);
  const tempPoints = extractData('temp').map(p => p ? { ...p, y: getY(p.y, 35, 42) } : null);
  
  // PA Area (Polygon)
  const renderPA = () => {
    let paths = [];
    for (let i = 0; i < hours.length; i++) {
      if (sysPoints[i] && diaPoints[i]) {
        const ySys = getY(sysPoints[i]!.y, 0, 250);
        const yDia = getY(diaPoints[i]!.y, 0, 250);
        // Draw vertical line for BP
        paths.push(
          <line key={i} x1={sysPoints[i]!.x} y1={ySys} x2={sysPoints[i]!.x} y2={yDia} stroke="#ef4444" strokeWidth="4" opacity="0.6" strokeLinecap="round" />
        );
        // Draw circles
        paths.push(<circle key={`s${i}`} cx={sysPoints[i]!.x} cy={ySys} r="3" fill="#ef4444" />);
        paths.push(<circle key={`d${i}`} cx={sysPoints[i]!.x} cy={yDia} r="3" fill="#ef4444" />);
      }
    }
    return paths;
  };

  const createLinePath = (points: ({x: number, y: number} | null)[]) => {
    return points.map((p, i) => {
      if (!p) return null;
      // Look ahead for next point to connect
      const next = points[i+1];
      if (next) return `M ${p.x} ${p.y} L ${next.x} ${next.y}`;
      return null; 
    }).filter(Boolean).join(' ');
  };

  return (
    <div className="w-full overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="min-w-[1200px] relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-slate-50 rounded-xl">
           {/* Grid X */}
           {hours.map((h, i) => (
             <g key={h}>
               <line x1={getX(i)} y1={padding.top} x2={getX(i)} y2={height - padding.bottom} stroke="#e2e8f0" strokeDasharray="4" />
               <text x={getX(i)} y={height - 10} textAnchor="middle" fontSize="12" fill="#64748b" fontWeight={i % 4 === 0 ? "bold" : "normal"}>{h}</text>
             </g>
           ))}
           
           {/* Axis Grid Lines based on PA scale (0-250) */}
           {[0, 50, 100, 150, 200, 250].map((val, i) => {
             const yPos = getY(val, 0, 250);
             // Corresponding FC value for the same grid line (0-200 scale)
             const fcVal = i * 40; // 0, 40, 80, 120, 160, 200

             return (
               <g key={val}>
                 <line x1={padding.left} y1={yPos} x2={width - padding.right} y2={yPos} stroke="#cbd5e1" strokeWidth="0.5" />
                 
                 {/* PA Label (Red) - Outermost */}
                 <text x={padding.left - 100} y={yPos + 4} textAnchor="end" fontSize="11" fill="#ef4444" fontWeight="bold">{val}</text>
                 
                 {/* FC Label (Green) - Middle */}
                 <text x={padding.left - 60} y={yPos + 4} textAnchor="end" fontSize="11" fill="#10b981" fontWeight="bold">{fcVal}</text>
               </g>
             );
           })}
           
           {/* Grid Y (Left - Temp) - Innermost (Next to axis with padding) */}
           {[36, 37, 38, 39, 40, 41].map(val => (
             <text key={val} x={padding.left - 20} y={getY(val, 35, 42) + 4} textAnchor="end" fontSize="11" fill="#3b82f6" fontWeight="bold">{val}°C</text>
           ))}

           {/* Graphs */}
           {renderPA()}
           
           {/* FC Line */}
           <path d={createLinePath(fcPoints)} stroke="#10b981" strokeWidth="3" fill="none" strokeDasharray="5,5" />
           {fcPoints.map((p, i) => p && <circle key={i} cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="white" strokeWidth="2" />)}

           {/* Temp Line */}
           <path d={createLinePath(tempPoints)} stroke="#3b82f6" strokeWidth="3" fill="none" />
           {tempPoints.map((p, i) => p && <rect key={i} x={p.x - 4} y={p.y - 4} width="8" height="8" fill="#3b82f6" stroke="white" strokeWidth="2" />)}

        </svg>
        {/* Legend */}
        <div className="absolute top-4 left-[160px] bg-white/90 p-3 rounded-lg border border-gray-200 text-sm flex space-x-6 shadow-md backdrop-blur-sm">
           <span className="flex items-center text-red-500 font-bold"><div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div> PA (mmHg)</span>
           <span className="flex items-center text-emerald-500 font-bold"><div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div> FC (bpm)</span>
           <span className="flex items-center text-blue-500 font-bold"><div className="w-2 h-2 bg-blue-500 mr-2"></div> Temp (°C)</span>
        </div>
      </div>
    </div>
  );
};

// --- Initial Data Config ---
const STATIC_SECTIONS: SectionConfig[] = [
  // --- PAGE 1 CONTENT ---
  {
    id: 'vital', title: 'Paramètres Vitaux', icon: Activity, color: 'text-rose-600',
    rows: [
      { id: 'pa_sys', label: 'PA Systolique', unit: 'mmHg', type: 'number' },
      { id: 'pa_dia', label: 'PA Diastolique', unit: 'mmHg', type: 'number' },
      { id: 'fc', label: 'Fréquence Cardiaque', unit: 'bpm', type: 'number', bgColor: 'bg-emerald-50' },
      { id: 'temp', label: 'Température', unit: '°C', type: 'number', bgColor: 'bg-blue-50' },
    ]
  },
  {
    id: 'neuro', title: 'État Clinique & Neuro', icon: Brain, color: 'text-indigo-600',
    rows: [
      { id: 'spo2', label: 'SpO₂', unit: '%', type: 'number' },
      { id: 'eva', label: 'Douleur (EVA)', unit: '/10', type: 'number' },
      { id: 'ramsay', label: 'Score Ramsay', type: 'select', options: ['1', '2', '3', '4', '5', '6'] },
      { id: 'glasgow', label: 'Score Glasgow', unit: '/15', type: 'number' },
      { id: 'pupilles', label: 'Pupilles', type: 'select', options: ['N/N', 'Myosis', 'Mydriase', 'Aniso'] },
    ]
  },
  {
    id: 'hemo', title: 'Monitorage Hémo. Invasif', icon: Activity, color: 'text-red-700',
    rows: [
      { id: 'pap', label: 'PAP', unit: 'mmHg', type: 'number' },
      { id: 'pcp', label: 'PCP', unit: 'mmHg', type: 'number' },
      { id: 'pvc', label: 'POD / PVC', unit: 'mmHg', type: 'number' },
      { id: 'dc', label: 'DC / IC', unit: 'L/min', type: 'number' },
      { id: 'svo2', label: 'SvO₂', unit: '%', type: 'number' },
    ]
  },
  {
    id: 'ventilation', title: 'Paramètres Ventilatoires', icon: Wind, color: 'text-sky-600',
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
    id: 'secretion', title: 'Aspirations Trachéales', icon: Thermometer, color: 'text-slate-600',
    rows: [
      { id: 'aspi_cote', label: 'Cotation', type: 'select', options: ['0', '1', '2', '3'] },
      { id: 'aspi_aspect', label: 'Aspect Sécrétions', type: 'text' },
    ]
  },
  {
    id: 'drains', title: 'Drains & Redons', icon: Droplet, color: 'text-amber-600',
    rows: [] // Dynamic
  },
  {
    id: 'diurese', title: 'Diurèse', icon: FlaskConical, color: 'text-yellow-600',
    rows: [
      { id: 'diurese_qty', label: 'SU / Miction', unit: 'ml', type: 'number', isOutput: true },
      { id: 'diurese_cumul', label: 'Cumul (ml)', unit: 'ml', type: 'computed', computeSource: 'diurese_qty', bgColor: 'bg-yellow-50 font-bold' },
    ]
  },
  {
    id: 'gastrique', title: 'Sonde Gastrique', icon: Syringe, color: 'text-green-600',
    rows: [
      { id: 'aspi_gastrique', label: 'Aspiration Gastrique', unit: 'ml', type: 'number', isOutput: true },
      { id: 'residu', label: 'Résidu Gastrique', unit: 'ml', type: 'number', isOutput: true },
      { id: 'vomis', label: 'Vomis / Selles', unit: 'ml', type: 'text', isOutput: true },
    ]
  },
  {
    id: 'gaz', title: 'Gaz du Sang & Bio', icon: FlaskConical, color: 'text-purple-600',
    rows: [
      { id: 'ph', label: 'pH', type: 'number' },
      { id: 'po2', label: 'PaO₂', unit: 'mmHg', type: 'number' },
      { id: 'pco2', label: 'PaCO₂', unit: 'mmHg', type: 'number' },
      { id: 'hco3', label: 'HCO₃⁻', unit: 'mmol/L', type: 'number' },
      { id: 'sao2_gaz', label: 'SaO₂', unit: '%', type: 'number' },
      { id: 'hb', label: 'Hb / Hte', type: 'text' },
      { id: 'glyc', label: 'Glycémie', unit: 'g/L', type: 'number' },
      { id: 'k', label: 'K⁺', unit: 'mmol/L', type: 'number' },
      { id: 'lactate', label: 'Ac. Lactique', unit: 'mmol/L', type: 'number', bgColor: 'bg-purple-50' },
    ]
  },
  {
    id: 'bilan', title: 'Bilan Hydrique (Auto)', icon: Calculator, color: 'text-blue-800',
    rows: [
        { id: 'apports_total', label: 'Apports Totaux (Perf/PO)', unit: 'ml', type: 'number', isInput: true, bgColor: 'bg-blue-50' },
        { id: 'bilan_horaire', label: 'Bilan Horaire', unit: 'ml', type: 'computed_vertical', bgColor: 'bg-gray-100 font-bold' },
        { id: 'bilan_cumul_24h', label: 'Bilan Cumulé 24h', unit: 'ml', type: 'computed', computeSource: 'bilan_horaire', bgColor: 'bg-gray-200 font-black text-blue-900' },
    ]
  },
  // --- PAGE 2 CONTENT (INTEGRATED) ---
  {
    id: 'cutane', title: 'Soins Infirmiers & Cutané', icon: CheckSquare, color: 'text-teal-600',
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
    id: 'divers', title: 'Divers', icon: CheckSquare, color: 'text-gray-600',
    rows: [
      { id: 'tour_secu', label: 'Tour de sécurité', type: 'text' },
      { id: 'environnement', label: 'Environnement', type: 'text' },
      { id: 'contentions', label: 'Tour contentions', type: 'text' },
    ]
  }
];

export const FicheSurveillance: React.FC = () => {
  // --- State ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allData, setAllData] = useState<AllData>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    STATIC_SECTIONS.reduce((acc, sec) => ({ ...acc, [sec.id]: true }), {})
  );
  
  // Chart Modal State
  const [showChart, setShowChart] = useState(false);
  
  // Dynamic Rows State
  const [drainCount, setDrainCount] = useState(1);
  const [redonCount, setRedonCount] = useState(1);
  const [customDiversRows, setCustomDiversRows] = useState<{id: string, label: string}[]>([]);
  
  // Modal Add Row State
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const [newRowName, setNewRowName] = useState('');
  
  // Derived
  const dateKey = selectedDate.toISOString().split('T')[0];
  const currentDayData = allData[dateKey] || {};
  const isToday = new Date().toDateString() === selectedDate.toDateString();
  const currentHourIndex = new Date().getHours() >= 8 
    ? new Date().getHours() - 8 
    : new Date().getHours() + 16;
  const currentHourLabel = isToday ? (HOURS[currentHourIndex] || '') : '';

  // --- Logic : Building Dynamic Grid ---
  const sections = useMemo(() => {
    return STATIC_SECTIONS.map(section => {
      if (section.id === 'drains') {
        const rows: RowConfig[] = [];
        
        // --- DRAINS (Complex Structure) ---
        rows.push({ id: 'header_drains', label: 'DRAINS', type: 'section_header', bgColor: 'bg-amber-100 text-amber-900 font-bold' });
        
        for (let i = 1; i <= drainCount; i++) {
          rows.push({ id: `drain_header_${i}`, label: `Drain ${i}`, type: 'section_header', bgColor: 'bg-gray-50 text-xs italic' });
          rows.push({ id: `drain_${i}_bullage`, label: `Bullage`, type: 'checkbox' });
          rows.push({ id: `drain_${i}_traite`, label: `Traite`, type: 'checkbox' });
          rows.push({ id: `drain_${i}_qty`, label: `Quantité`, unit: 'ml/h', type: 'number', isOutput: true });
          rows.push({ id: `drain_${i}_chgt`, label: `Changement`, type: 'checkbox' });
        }

        // Global Drains Cumul
        rows.push({
          id: 'total_drains_cumul',
          label: 'Cumul Drains (Total)',
          unit: 'ml',
          type: 'computed',
          computeSource: 'drain_all_qty', 
          bgColor: 'bg-amber-200 font-bold',
          textColor: 'text-amber-900'
        });

        // --- REDONS (Grouped Sum) ---
        rows.push({ id: 'header_redons', label: 'REDONS', type: 'section_header', bgColor: 'bg-orange-100 text-orange-900 font-bold' });
        
        for (let i = 1; i <= redonCount; i++) {
          rows.push({ id: `redon_${i}_qty`, label: `Redon ${i} (Qté)`, unit: 'ml/h', type: 'number', isOutput: true });
        }
        
        // Global Redon Cumul
        rows.push({
          id: 'total_redons_cumul',
          label: 'Cumul Redons (Total)',
          unit: 'ml',
          type: 'computed',
          computeSource: 'redon_all_qty', // Special flag handled in calc
          bgColor: 'bg-orange-200 font-bold',
          textColor: 'text-orange-900'
        });

        return { ...section, rows };
      }
      
      if (section.id === 'divers') {
        const rows = [...section.rows];
        customDiversRows.forEach(custom => {
          rows.push({
            id: custom.id,
            label: custom.label,
            type: 'text'
          });
        });
        return { ...section, rows };
      }

      return section;
    });
  }, [drainCount, redonCount, customDiversRows]);

  // --- Calculations ---

  const calculateCumul = (sourceRowId: string, currentHour: string): number => {
    let total = 0;
    const hourIndex = HOURS.indexOf(currentHour);
    
    // Total Drains Cumul
    if (sourceRowId === 'drain_all_qty') {
       for (let i = 0; i <= hourIndex; i++) {
         const h = HOURS[i];
         for (let d = 1; d <= drainCount; d++) {
            const val = parseFloat(currentDayData[`drain_${d}_qty`]?.[h] as string || '0');
            if (!isNaN(val)) total += val;
         }
       }
       return total;
    }
    
    // Special Case: Total Redons Cumul (Sums all redon rows vertically then horizontally)
    if (sourceRowId === 'redon_all_qty') {
       for (let i = 0; i <= hourIndex; i++) {
         const h = HOURS[i];
         // Sum all redons for this hour
         for (let r = 1; r <= redonCount; r++) {
            const val = parseFloat(currentDayData[`redon_${r}_qty`]?.[h] as string || '0');
            if (!isNaN(val)) total += val;
         }
       }
       return total;
    }

    // Standard Horizontal Cumul
    for (let i = 0; i <= hourIndex; i++) {
      const h = HOURS[i];
      const val = parseFloat(currentDayData[sourceRowId]?.[h] as string || '0');
      if (!isNaN(val)) total += val;
    }
    return total;
  };

  const calculateBilanHoraire = (hour: string): number => {
    let inputs = 0;
    let outputs = 0;

    // Scan all active sections to find inputs/outputs
    // We need to look at 'sections' derived from state to include dynamic rows
    sections.forEach(sec => sec.rows.forEach(row => {
      const val = parseFloat(currentDayData[row.id]?.[hour] as string || '0');
      if (!isNaN(val)) {
        if (row.isInput) inputs += val;
        if (row.isOutput) outputs += val;
      }
    }));
    
    // Add Apports manually if needed from other logic
    const apports = parseFloat(currentDayData['apports_total']?.[hour] as string || '0');
    if (!isNaN(apports)) inputs += apports;

    // Robust calculation based on ALL configured rows (static + dynamic generated logic)
    // Re-generate dynamic IDs
    const dynamicOutputIds = [];
    for(let i=1; i<=drainCount; i++) dynamicOutputIds.push(`drain_${i}_qty`);
    for(let i=1; i<=redonCount; i++) dynamicOutputIds.push(`redon_${i}_qty`);
    
    const staticOutputIds = ['diurese_qty', 'aspi_gastrique', 'residu', 'vomis'];
    
    [...dynamicOutputIds, ...staticOutputIds].forEach(id => {
       const v = parseFloat(currentDayData[id]?.[hour] as string || '0');
       if(!isNaN(v)) outputs += v;
    });

    return inputs - outputs;
  };

  const handleInputChange = (rowId: string, hour: string, value: any) => {
    setAllData(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [rowId]: {
          ...(prev[dateKey]?.[rowId] || {}),
          [hour]: value
        }
      }
    }));
  };

  const copyPreviousColumn = (targetHour: string) => {
    const targetIndex = HOURS.indexOf(targetHour);
    if (targetIndex <= 0) return;
    const prevHour = HOURS[targetIndex - 1];
    const newDayData = { ...currentDayData };
    
    // Copy logic (simplified)
    Object.keys(currentDayData).forEach(rowId => {
       if (currentDayData[rowId]?.[prevHour] !== undefined) {
         if (!newDayData[rowId]) newDayData[rowId] = {};
         newDayData[rowId][targetHour] = currentDayData[rowId][prevHour];
       }
    });

    setAllData(prev => ({ ...prev, [dateKey]: newDayData }));
  };

  const handleAddDiversRow = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling the section
    setNewRowName("");
    setIsAddRowModalOpen(true);
  };

  const confirmAddRow = () => {
    if (newRowName && newRowName.trim() !== "") {
      const id = `divers_custom_${Date.now()}`;
      setCustomDiversRows(prev => [...prev, { id, label: newRowName.trim() }]);
      setIsAddRowModalOpen(false);
    }
  };

  // --- Render Cell Helper ---
  const renderCell = (row: RowConfig, hour: string) => {
    if (row.type === 'section_header') return <div className={`w-full h-full ${row.bgColor}`}></div>;

    if (row.type === 'computed') {
      const val = calculateCumul(row.computeSource!, hour);
      return <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-600">{val !== 0 ? val : '-'}</div>;
    }
    
    if (row.type === 'computed_vertical' && row.id === 'bilan_horaire') {
        const val = calculateBilanHoraire(hour);
        const color = val > 0 ? 'text-blue-600' : (val < 0 ? 'text-red-600' : 'text-gray-400');
        return <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${color}`}>{val !== 0 ? (val > 0 ? `+${val}` : val) : '0'}</div>;
    }

    const val = currentDayData[row.id]?.[hour];

    if (row.type === 'checkbox') {
      return (
        <div className="flex items-center justify-center w-full h-full cursor-pointer transition-colors hover:bg-emerald-50/30" onClick={() => handleInputChange(row.id, hour, !(val as boolean))}>
          {val ? (
            <CheckSquare size={18} className="text-emerald-600" strokeWidth={2.5} />
          ) : (
            <div className="w-4 h-4 border-2 border-gray-300 rounded hover:border-emerald-400 transition-colors"></div>
          )}
        </div>
      );
    }

    if (row.type === 'select' && row.options) {
      return (
        <select
          value={val as string || ''}
          onChange={(e) => handleInputChange(row.id, hour, e.target.value)}
          className="w-full h-full bg-transparent border-none text-xs text-center focus:ring-0 p-0 appearance-none font-medium text-gray-800"
        >
          <option value=""></option>
          {row.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }

    // Number or Text
    const isNumberType = row.type === 'number';
    const isVomis = row.id === 'vomis';
    
    return (
      <input
        type={isNumberType ? 'number' : 'text'}
        min={isNumberType ? "0" : undefined}
        value={val as string || ''}
        onChange={(e) => {
           let newValue = e.target.value;
           if (isNumberType && newValue !== '' && Number(newValue) < 0) {
             return; // Ignore negative input
           }
           if (isVomis && newValue.trim().startsWith('-')) {
             return;
           }
           handleInputChange(row.id, hour, newValue);
        }}
        onKeyDown={(e) => {
            // Block minus sign for number fields and specific text fields that act as quantities
            if ((isNumberType || isVomis) && e.key === '-') {
                e.preventDefault();
            }
        }}
        className="w-full h-full bg-transparent border-none text-center focus:ring-2 focus:ring-emerald-500 p-0 text-sm font-medium text-gray-900 placeholder-gray-300"
        placeholder={hour === currentHourLabel ? '...' : ''}
      />
    );
  };

  return (
    <div className="flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 font-sans w-full relative h-[calc(100vh-300px)]">
      {/* --- Top Bar --- */}
      <div className="flex-none flex flex-col sm:flex-row items-center justify-between p-3 border-b border-gray-200 bg-gray-50 gap-4 shadow-sm z-30 rounded-t-lg">
        {/* Date Nav */}
        <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm p-0.5">
          <button onClick={() => setSelectedDate(d => new Date(d.setDate(d.getDate() - 1)))} className="p-1 hover:bg-gray-100 text-gray-600"><ChevronLeft size={20} /></button>
          <div className="flex items-center mx-2 px-2 py-1 bg-gray-50 border-x border-gray-100">
             <CalendarIcon size={16} className="text-gray-500 mr-2" />
             <span className="font-bold text-gray-800 text-sm">{selectedDate.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
          </div>
          <button onClick={() => setSelectedDate(d => new Date(d.setDate(d.getDate() + 1)))} className="p-1 hover:bg-gray-100 text-gray-600"><ChevronRight size={20} /></button>
        </div>

        <div className="flex space-x-2">
           {isToday && (
            <button onClick={() => copyPreviousColumn(HOURS[currentHourIndex])} className="flex items-center px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
              <Copy size={14} className="mr-2" /> Recopier H-1
            </button>
           )}
           <button 
             onClick={() => setShowChart(true)}
             className="flex items-center px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 shadow-sm"
           >
             <LineChart size={14} className="mr-2" /> Voir Courbes
           </button>
           <button className="flex items-center px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded hover:bg-emerald-700 shadow-sm">
             <Save size={14} className="mr-2" /> Valider
           </button>
        </div>
      </div>

      {/* --- Grid --- */}
      <div className="flex-1 w-full overflow-auto">
          <table className="border-collapse w-full min-w-max">
            {/* Header */}
            <thead className="shadow-md">
              <tr className="bg-slate-800 text-white">
                <th className="p-2 text-left min-w-[200px] sticky left-0 top-0 z-50 bg-slate-900 border-r border-slate-700 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.5)]">
                  Paramètres
                </th>
                {HOURS.map((h, i) => (
                  <th key={h} className={`w-14 min-w-[56px] text-center text-xs font-mono py-2 border-r border-slate-700 sticky top-0 z-40 ${h === currentHourLabel ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sections.map(section => (
                 <React.Fragment key={section.id}>
                    {/* Section Header Row */}
                    <tr className="bg-slate-100">
                      {/* Sticky Title Cell */}
                      <td className="sticky left-0 z-20 p-0 border-y border-r border-gray-300 bg-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-between px-2 py-1.5 min-w-[200px]">
                           <button 
                              onClick={() => setOpenSections(p => ({...p, [section.id]: !p[section.id]}))}
                              className="flex items-center font-bold text-sm text-gray-800 uppercase truncate"
                           >
                             {openSections[section.id] ? <ChevronDown size={14} className="mr-2 flex-shrink-0" /> : <ChevronRight size={14} className="mr-2 flex-shrink-0" />}
                             <section.icon size={14} className={`mr-2 flex-shrink-0 ${section.color}`} />
                             <span className="truncate">{section.title}</span>
                           </button>

                           {/* Dynamic Buttons */}
                           {section.id === 'drains' && openSections[section.id] && (
                             <div className="flex space-x-2 ml-2">
                               <button onClick={() => setDrainCount(c => c + 1)} className="text-[10px] flex items-center bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200 hover:bg-amber-200 whitespace-nowrap">
                                 <PlusCircle size={10} className="mr-1"/> Drain
                               </button>
                               <button onClick={() => setRedonCount(c => c + 1)} className="text-[10px] flex items-center bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200 hover:bg-orange-200 whitespace-nowrap">
                                 <PlusCircle size={10} className="mr-1"/> Redon
                               </button>
                             </div>
                           )}

                           {section.id === 'divers' && openSections[section.id] && (
                             <div className="flex space-x-2 ml-2">
                               <button onClick={handleAddDiversRow} className="text-[10px] flex items-center bg-gray-200 text-gray-800 px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-300 whitespace-nowrap">
                                 <PlusCircle size={10} className="mr-1"/> Ajouter
                               </button>
                             </div>
                           )}
                        </div>
                      </td>
                      
                      {/* Filler Cell */}
                      <td colSpan={HOURS.length} className="p-0 border-y border-gray-300 bg-slate-100"></td>
                    </tr>

                    {/* Data Rows */}
                    {openSections[section.id] && section.rows.map(row => (
                      <tr key={row.id} className={`group hover:bg-blue-50/50 ${row.bgColor || 'bg-white'}`}>
                        {/* Sticky Label Column */}
                        <td className={`
                           p-1.5 sticky left-0 z-10 border-r border-b border-gray-200 text-xs font-medium text-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]
                           ${row.bgColor || 'bg-white'}
                           ${row.type === 'section_header' ? 'text-center font-bold italic' : ''}
                           ${row.textColor || ''}
                        `}>
                          <div className="flex justify-between items-center px-1">
                             <span className="truncate" title={row.label}>{row.label}</span>
                             {row.unit && <span className="text-[9px] text-gray-400 ml-1">{row.unit}</span>}
                          </div>
                        </td>
                        
                        {/* Cells */}
                        {HOURS.map((h) => (
                          <td 
                            key={h} 
                            className={`
                               border-r border-b border-gray-200 h-8 p-0 relative transition-colors
                               ${row.type === 'section_header' ? row.bgColor : ''}
                               ${h === currentHourLabel && row.type !== 'section_header' ? 'bg-emerald-50/40 ring-1 ring-inset ring-emerald-100' : ''}
                            `}
                          >
                            {renderCell(row, h)}
                          </td>
                        ))}
                      </tr>
                    ))}
                 </React.Fragment>
              ))}
            </tbody>
          </table>
      </div>

      {/* --- Chart Modal --- */}
      {showChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
               <h3 className="text-xl font-bold text-gray-900 flex items-center">
                 <Activity className="mr-2 text-rose-600" />
                 Courbes des Paramètres Vitaux
               </h3>
               <button onClick={() => setShowChart(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors">
                 <X size={24} />
               </button>
            </div>
            <div className="p-6 overflow-x-auto bg-gray-50 flex-1">
               <VitalSignsChart data={currentDayData} hours={HOURS} />
               <p className="text-center text-sm text-gray-500 mt-4">
                 Les données affichées correspondent à la journée du <strong>{selectedDate.toLocaleDateString('fr-FR')}</strong>.
               </p>
            </div>
          </div>
        </div>
      )}

      {/* --- Add Row Modal --- */}
      {isAddRowModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <h3 className="text-lg font-bold text-gray-900">Ajouter un paramètre</h3>
                      <button onClick={() => setIsAddRowModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nom du paramètre (ex: Soins de bouche)</label>
                      <input 
                          type="text" 
                          autoFocus
                          value={newRowName}
                          onChange={(e) => setNewRowName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && confirmAddRow()}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-gray-900"
                      />
                      <div className="flex justify-end space-x-3 mt-6">
                          <button onClick={() => setIsAddRowModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Annuler</button>
                          <button onClick={confirmAddRow} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium">Ajouter</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};