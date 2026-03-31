import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  X,
  Pill,
  ScanLine,
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PauseCircle,
  StopCircle,
  Info,
  ShieldAlert,
  FileText,
  Pause,
  Square,
  Ban,
  Hourglass
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Prescription, PrescriptionExecution, ExecutionStatus } from '../Prescription/types';
import { AdministrationSavePayload } from './AdministrationModal';
import { AdminModalPortal } from './FicheSurveillance/AdminModalPortal';
import { useAdminModalDispatch, AdminModalProvider } from './FicheSurveillance/AdminModalContext';
import { generateDoseSchedule, durationToDecimal } from '../Prescription/utils';

// --- Point-Collision Lane Allocator ---
export type LaneAssigned<T> = T & { lane: number };

export type LaneAllocatorOpts<T> = {
  // X coordinate (px) for the point you want to protect from collisions (usually actualX)
  xOf: (item: T) => number;

  // Existing fixed X positions that must also be avoided (scheduled dots, etc.)
  fixedXsOf?: (item: T) => number[];

  // Minimum distance (px) required between two points in the same lane
  minSeparationPx: number;
};

/**
 * Assigns the smallest possible lane index to each item so that
 * no two items in the same lane collide (|x1 - x2| < minSeparationPx).
 * Additionally, items placed in lane 0 must not collide with fixedXs.
 *
 * This is a greedy lane assignment (like calendar events),
 * but for POINTS (not intervals).
 */
export function assignPointLanes<T>(
  items: T[],
  opts: LaneAllocatorOpts<T>
): LaneAssigned<T>[] {
  const { xOf, fixedXsOf, minSeparationPx } = opts;

  // Sort by x so greedy works deterministically
  const sorted = [...items].sort((a, b) => xOf(a) - xOf(b));

  // lanes[laneIndex] = list of x already placed in that lane
  const lanes: number[][] = [];
  const out: LaneAssigned<T>[] = [];

  for (const item of sorted) {
    const x = xOf(item);
    const fixedXs = fixedXsOf ? fixedXsOf(item) : [];

    let lane = 0;
    while (true) {
      let collides = false;
      const laneXs = lanes[lane] || [];
      
      for (const lx of laneXs) {
        if (Math.abs(x - lx) < minSeparationPx) {
          collides = true;
          break;
        }
      }
      
      // If we are considering the centerline (lane 0), 
      // we MUST avoid fixedXs (the scheduled dots). 
      // Other lanes (> 0) are visually separate from the centerline dots.
      if (!collides && lane === 0) {
        for (const fx of fixedXs) {
          if (Math.abs(x - fx) < minSeparationPx) {
            collides = true;
            break;
          }
        }
      }
      
      if (!collides) {
        break; // we found a safe lane!
      }
      lane++;
    }

    if (!lanes[lane]) lanes[lane] = [];
    lanes[lane].push(x);

    out.push({ ...(item as any), lane });
  }

  return out;
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
        paths.push(<circle key={`s${i} `} cx={sysPoints[i]!.x} cy={ySys} r="3" fill="#ef4444" />);
        paths.push(<circle key={`d${i} `} cx={sysPoints[i]!.x} cy={yDia} r="3" fill="#ef4444" />);
      }
    }
    return paths;
  };

  const createLinePath = (points: ({ x: number, y: number } | null)[]) => {
    return points.map((p, i) => {
      if (!p) return null;
      // Look ahead for next point to connect
      const next = points[i + 1];
      if (next) return `M ${p.x} ${p.y} L ${next.x} ${next.y} `;
      return null;
    }).filter(Boolean).join(' ');
  };

  return (
    <div className="w-full overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="min-w-[1200px] relative">
        <svg viewBox={`0 0 ${width} ${height} `} className="w-full h-auto bg-slate-50 rounded-xl">
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

// --- Helper Functions for Timeline ---

const generateTimeSlots = (centerDate: Date) => {
  const intervals: { iso: string, label: string, isMidnight: boolean, isStartOfDay: boolean }[] = [];
  const start = new Date(centerDate);
  start.setHours(8, 0, 0, 0); // Always start at 08:00
  start.setDate(start.getDate() - 1); // Yesterday 08:00
  
  for(let i = 0; i < 72; i++) {
    const slot = new Date(start.getTime() + i * 3600000);
    intervals.push({
      iso: slot.toISOString(),
      label: slot.getHours().toString().padStart(2, '0') + 'h',
      isMidnight: slot.getHours() === 0,
      isStartOfDay: slot.getHours() === 8
    });
  }
  return intervals;
};

const isSlotLate = (
  slotIso: string,
  execution?: PrescriptionExecution
): boolean => {
  const now = new Date();
  const plannedTime = new Date(slotIso);

  if (execution && execution.status === 'administered') {
    return false;
  }

  // 30 min grace period
  if (now.getTime() > (plannedTime.getTime() + (30 * 60 * 1000))) {
    return true;
  }

  return false;
};

// --- Types de Données ---
type CellValue = string | boolean | number;
type DailyGridData = Record<string, Record<string, CellValue>>;
type AllData = Record<string, DailyGridData>;

interface RowConfig {
  id: string; // parameter code
  parameterId?: string; // parameter UUID
  label: React.ReactNode;
  epicHeader?: React.ReactNode;
  epicSubtext?: React.ReactNode;
  unit?: string;
  type: 'number' | 'text' | 'select' | 'checkbox' | 'prescription_timeline' | 'computed' | 'computed_vertical' | 'section_header';
  options?: string[];
  isInput?: boolean; 
  isOutput?: boolean;
  isSubheader?: boolean;
  computeSource?: string; // Styling Overrides
  bgColor?: string; // Defines the base row background (e.g., 'bg-white', 'bg-amber-50')
  hoverBg?: string; // Defines the interactive hover layer explicitly (e.g., 'group-hover:bg-blue-50')
  status?: string;
  textColor?: string;
  prescriptionId?: string;
  prescriptionData?: any;
  normalMin?: number;
  normalMax?: number;
  warningMin?: number;
  warningMax?: number;
  hardMin?: number;
  hardMax?: number;
  source?: 'manual' | 'calculated';
}

interface FicheSurveillanceProps {
  patientId?: string;
  isActiveWorkspace?: boolean;
  isActiveTab?: boolean;
}

interface SectionConfig {
  id: string;
  title: string;
  icon: any;
  color: string;
  rows: RowConfig[];
}

const ExpandableNameBadge = ({ name, molecule }: { name: string, molecule?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  const formattedName = name ? (name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()) : '';
  const formattedMolecule = molecule ? (molecule.charAt(0).toUpperCase() + molecule.slice(1).toLowerCase()) : '';
  const isLong = formattedName.length > 25 || formattedMolecule.length > 30;

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCoords({ top: rect.top - 8, left: rect.left - 8 });
    }
    setIsOpen(true);
  };

  return (
    <div className="relative inline-block min-w-0 w-full" ref={containerRef} onMouseLeave={() => setIsOpen(false)}>
      {isOpen && isLong && createPortal(
         <div 
           className="fixed z-[99999] bg-white shadow-2xl border border-slate-300 ring-1 ring-slate-200/50 rounded-lg p-3 w-[340px] cursor-pointer animate-in fade-in zoom-in-95 duration-100" 
           style={{ top: coords.top, left: coords.left }}
           onClick={() => setIsOpen(false)}
           onMouseLeave={() => setIsOpen(false)}
         >
            <div className="font-bold text-slate-800 text-[14px] leading-snug whitespace-normal break-words">{formattedName}</div>
            {molecule && molecule !== name && (
              <div className="italic text-blue-600 font-medium text-[11px] leading-snug mt-1.5 whitespace-normal break-words">{formattedMolecule}</div>
            )}
         </div>,
         document.body
      )}

      {isLong ? (
        <button 
           onClick={handleOpen}
           className="text-left flex flex-col items-start min-w-0 w-full hover:bg-slate-50 rounded-md -ml-1.5 px-1.5 py-0.5 transition-colors border border-transparent hover:border-slate-300 shadow-sm hover:shadow"
        >
           <span className="font-bold text-slate-800 text-[14px] leading-tight truncate w-full">{formattedName}</span>
           {molecule && molecule !== name && (
             <span className="italic text-blue-600 font-medium text-[11px] truncate w-full leading-tight mt-0.5">
               {formattedMolecule}
             </span>
           )}
        </button>
      ) : (
        <div className="flex flex-col items-start min-w-0 w-full px-1.5 py-0.5 -ml-1.5">
          <span className="font-bold text-slate-800 text-[14px] leading-tight truncate w-full">
            {formattedName}
          </span>
          {molecule && molecule !== name && (
            <span className="italic text-blue-600 font-medium text-[11px] truncate w-full leading-tight mt-0.5">
              {formattedMolecule}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// A dedicated GridCell component is critical for Excel-style tables.
// It manages its own typing state so the global FicheSurveillance (and all 72 columns)
// does not re-render on every single keystroke.
const GridCell = ({
  initialValue,
  isNumberType,
  isVomis,
  config,
  isCurrentHour,
  onCommit
}: {
  initialValue: string;
  isNumberType: boolean;
  isVomis: boolean;
  config: RowConfig;
  isCurrentHour: boolean;
  onCommit: (val: string) => void;
}) => {
  const [localVal, setLocalVal] = useState(initialValue || '');
  const [isFocused, setIsFocused] = useState(false);

  // Sync if row/global data heavily changes (e.g. initial load)
  useEffect(() => {
    setLocalVal(initialValue || '');
  }, [initialValue]);

  // Compute color class & tooltip strictly derived from local value + blur state
  let colorClass = "text-gray-900 bg-transparent font-medium";
  let tooltip = "";

  if (isNumberType && localVal !== undefined && localVal !== '' && !isFocused) {
    const numVal = Number(localVal);
    
    const hasHardMin = config.hardMin !== undefined && config.hardMin !== null;
    const hasHardMax = config.hardMax !== undefined && config.hardMax !== null;
    const hasWarnMin = config.warningMin !== undefined && config.warningMin !== null;
    const hasWarnMax = config.warningMax !== undefined && config.warningMax !== null;
    const hasNormMin = config.normalMin !== undefined && config.normalMin !== null;
    const hasNormMax = config.normalMax !== undefined && config.normalMax !== null;

    const breaksHardMin = hasHardMin && numVal < config.hardMin!;
    const breaksHardMax = hasHardMax && numVal > config.hardMax!;

    if (breaksHardMin || breaksHardMax) {
      // 1. HARD LIMIT VIOLATION
      colorClass = "text-red-600 font-bold bg-transparent ring-2 ring-inset ring-red-500 m-[1px]";
      if (hasHardMin && hasHardMax) {
        tooltip = `Valeur hors limites. Autorisé: ${config.hardMin} - ${config.hardMax} ${config.unit || ''}`.trim();
      } else if (hasHardMin) {
        tooltip = `Valeur sous le minimum autorisé: ${config.hardMin} ${config.unit || ''}`.trim();
      } else {
        tooltip = `Valeur au-dessus du maximum autorisé: ${config.hardMax} ${config.unit || ''}`.trim();
      }
    } else {
      // 2. CRITICAL LIMIT VIOLATION (Warning in DB context, mapped to red)
      const breaksWarnMin = hasWarnMin && numVal < config.warningMin!;
      const breaksWarnMax = hasWarnMax && numVal > config.warningMax!;
      
      if (breaksWarnMin || breaksWarnMax) {
        colorClass = "text-red-500 font-bold bg-transparent";
      } else {
        // 3. WARNING LIMIT VIOLATION (Normal min/max breached, mapped to orange)
        const breaksNormMin = hasNormMin && numVal < config.normalMin!;
        const breaksNormMax = hasNormMax && numVal > config.normalMax!;

        if (breaksNormMin || breaksNormMax) {
          colorClass = "text-orange-500 font-bold bg-transparent";
        } else if (hasNormMin || hasNormMax) { 
          // 4. NORMAL (strictly inside all bounds)
          colorClass = "text-emerald-600 font-bold bg-transparent";
        }
      }
    }
  }

  if (config.source === 'calculated') {
    return (
      <div 
        className="w-full h-full flex items-center justify-center text-sm font-medium text-slate-700 bg-slate-100 cursor-not-allowed select-none"
      >
        {localVal}
      </div>
    );
  }

  return (
    <input
      type={isNumberType ? 'number' : 'text'}
      min={isNumberType ? "0" : undefined}
      value={localVal}
      onFocus={() => setIsFocused(true)}
      onChange={(e) => {
        let newValue = e.target.value;
        if (isNumberType && newValue !== '' && Number(newValue) < 0) {
          return; // Ignore negative
        }
        if (isVomis && newValue.trim().startsWith('-')) {
          return;
        }
        setLocalVal(newValue);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        if (e.target.value !== initialValue) {
           onCommit(e.target.value);
        }
      }}
      onKeyDown={(e) => {
        if ((isNumberType || isVomis) && e.key === '-') e.preventDefault();
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      title={tooltip || undefined}
      // [&::-webkit...]:appearance-none hides the up/down chevrons (spinners) on number inputs
      className={`w-full h-full border-none text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 p-0 text-sm transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${colorClass}`}
      placeholder={isCurrentHour ? '...' : ''}
    />
  );
};

export const FicheSurveillance: React.FC<FicheSurveillanceProps> = ({ patientId, isActiveWorkspace = true, isActiveTab = true }) => {
  const { user } = useAuth();
  const dispatch = useAdminModalDispatch();


  // --- State ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allData, setAllData] = useState<AllData>({});
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Data State
  const [allPrescriptions, setAllPrescriptions] = useState<Prescription[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  // We can eventually phase out `executions` state as timelineEvents contains `administration`, but keep it for now if needed elsewhere.
  const [executions, setExecutions] = useState<PrescriptionExecution[]>([]);
  
  const [flowsheets, setFlowsheets] = useState<any[]>([]);
  const [activeFlowsheetId, setActiveFlowsheetId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [bloodBags, setBloodBags] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);

  // Strip adminModal state

  const handleCancelAdminEvent = async (prescriptionId: string, eventId: string, adminEventId: string, reason?: string) => {
    if (!patientId || !prescriptionId || !eventId) return;
    try {
        await api.cancelAdministrationEvent(prescriptionId, eventId, adminEventId, reason);
        // Force a fresh fetch of the 72h window immediately to clear the UI
        const survStart = new Date(timeSlots[0].iso);
        const survEnd = new Date(timeSlots[timeSlots.length - 1].iso);
        survEnd.setHours(survEnd.getHours() + 1);
        const res = await api.getSurveillanceTimeline(patientId!, {
            flowsheetId: activeFlowsheetId!,
            fromDate: survStart.toISOString(),
            toDate: survEnd.toISOString()
        });
        if (res.timelineEvents) setTimelineEvents(res.timelineEvents);
        
        fetchWindowData(); // Synchronize the cached hydric values immediately
    } catch (err) {
        console.error("Failed to cancel administration event", err);
        alert("Erreur lors de l'annulation de l'événement.");
    }
  };

  const handleSkipPrescriptionEvent = async (prescriptionId: string, eventId: string) => {
    if (!patientId || !activeFlowsheetId || !prescriptionId) return;
    try {
        await api.skipPrescriptionEvent(eventId);
        
        // Force fetch to propagate visual Skipped state
        const survStart = new Date(timeSlots[0].iso);
        const survEnd = new Date(timeSlots[timeSlots.length - 1].iso);
        survEnd.setHours(survEnd.getHours() + 1);
        const res = await api.getSurveillanceTimeline(patientId!, {
            flowsheetId: activeFlowsheetId,
            fromDate: survStart.toISOString(),
            toDate: survEnd.toISOString()
        });
        if (res.timelineEvents) setTimelineEvents(res.timelineEvents);
        fetchWindowData();
    } catch (err: any) {
        console.error("Failed to skip event", err);
        alert(err.response?.data?.error || "Erreur lors du saut de la prise.");
    }
  };

  // Stop Confirmation Modal Payload
  const [stopModal, setStopModal] = useState<{
      isOpen: boolean;
      prescriptionId: string;
  }>({
      isOpen: false,
      prescriptionId: ''
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    medication: true, biology: true, imagery: true, care: true, transfusion: true
  });

  // Derived Timeline Geometry
  const timeSlots = useMemo(() => generateTimeSlots(selectedDate), [selectedDate]);
  const dateKey = selectedDate.toISOString().split('T')[0];
  const currentDayData = allData[dateKey] || {};
  
  const currentHourIso = new Date();
  currentHourIso.setMinutes(0, 0, 0); // Floor exactly to hour
  const currentHourLabel = timeSlots.find(t => t.iso === currentHourIso.toISOString())?.iso || timeSlots[24]?.iso || '';

  // Auto-scroll to geometric center or current hour
  useEffect(() => {
    if (scrollContainerRef.current && currentHourLabel) {
      const targetId = `col-${currentHourLabel.replace(/[:.]/g, '-')}`;
      const targetCol = scrollContainerRef.current.querySelector(`#${targetId}`);
      // Slight delay to ensure DOM is fully repainted before scrolling
      if (targetCol) {
        setTimeout(() => {
            targetCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 100);
      }
    }
  }, [currentHourLabel, timeSlots]);

  // Fetch Global Data (Flowsheets & Prescriptions)
  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        const flowsheetsData = await api.getObservationFlowsheets();
        setFlowsheets(flowsheetsData);
        if (flowsheetsData.length > 0) setActiveFlowsheetId(flowsheetsData[0].id);

        const routesData = await api.getRoutes().catch(() => []);
        setRoutes(routesData);
      } catch (e) {
        console.error("Failed to load flowsheets or routes", e);
      }
      
      if (patientId) {
        try {
          const fetchedPrescriptions: any[] = await api.getPrescriptions(patientId);
          setAllPrescriptions(fetchedPrescriptions);

          const executionPromises = fetchedPrescriptions.map(p => api.getExecutions(p.id).catch(() => []));
          const allExecutions = (await Promise.all(executionPromises)).flat();
          setExecutions(allExecutions);
        } catch (error) {
          console.error("Failed to fetch prescriptions global data", error);
        }
        
        try {
          const bagsData = await api.getTransfusionBags(patientId);
          setBloodBags(bagsData);
        } catch (err) {
          console.error("Failed to fetch transfusion bags", err);
        }
      }
      try {
        const unitsData = await api.getUnits();
        setUnitsList(unitsData);
      } catch (err) {
        console.error("Failed to fetch units data", err);
      }
    };
    fetchGlobalData();
  }, [patientId]);

  // Explicitly refresh prescription metadata headers when the tab regains focus or the patient changes
  useEffect(() => {
    if (patientId && isActiveTab) {
      const refreshPrescriptionsMap = async () => {
        try {
          const fetchedPrescriptions: any[] = await api.getPrescriptions(patientId);
          setAllPrescriptions(fetchedPrescriptions);
          
          const executionPromises = fetchedPrescriptions.map(p => api.getExecutions(p.id).catch(() => []));
          const allExecutions = (await Promise.all(executionPromises)).flat();
          setExecutions(allExecutions);
        } catch (error) {
          console.error("Failed to refresh prescriptions global data on focus", error);
        }
      };
      refreshPrescriptionsMap();
    }
  }, [patientId, isActiveTab]);

  // Expose the Window Data Fetching logic outside the useEffect so we can forcefully hit it upon commit updates
  const fetchWindowData = useCallback(async () => {
    if (!patientId || !activeFlowsheetId || timeSlots.length === 0) return;
    try {
      const survStart = new Date(timeSlots[0].iso);
      const survEnd = new Date(timeSlots[timeSlots.length - 1].iso);
      survEnd.setHours(survEnd.getHours() + 1); // +1h to include the full last hour bucket

      const res = await api.getSurveillanceTimeline(patientId, {
        flowsheetId: activeFlowsheetId,
        fromDate: survStart.toISOString(),
        toDate: survEnd.toISOString()
      });

      const newGridData: DailyGridData = {};
      
      if (res.buckets) {
        res.buckets.forEach((b: any) => {
            const iso = new Date(b.bucketStart).toISOString();
            Object.entries(b.values || {}).forEach(([rowId, cellObj]: [string, any]) => {
                if (!newGridData[rowId]) newGridData[rowId] = {};
                newGridData[rowId][iso] = (cellObj && typeof cellObj === 'object' && cellObj.v !== undefined) ? cellObj.v : cellObj; 
            });
        });
      }

      setAllData(prev => ({ ...prev, [dateKey]: newGridData }));
      if (res.timelineEvents) {
          setTimelineEvents(res.timelineEvents);
      }
      
      if (res.flowsheet) {
          setOpenSections(prev => {
              const np = { ...prev };
              res.flowsheet.groups.forEach((g: any) => np[g.id] = np[g.id] ?? true);
              return np;
          });
      }

    } catch (error) {
      console.error("Failed to fetch 72h window buckets", error);
    }
  }, [patientId, activeFlowsheetId, timeSlots, dateKey]);

  // Fetch Surveillance Grid (72h window) polling
  // Fetch Surveillance Grid (72h window) polling
  useEffect(() => {
    if (patientId && activeFlowsheetId && isActiveWorkspace && isActiveTab) {
      fetchWindowData();
      const interval = setInterval(fetchWindowData, 30000); // 30s refresh
      return () => clearInterval(interval);
    }
  }, [patientId, activeFlowsheetId, fetchWindowData, isActiveWorkspace, isActiveTab]);

  // Chart Modal State
  const [showChart, setShowChart] = useState(false);

  // Dynamic Rows State
  const [drainCount, setDrainCount] = useState(1);
  const [redonCount, setRedonCount] = useState(1);
  const [customDiversRows, setCustomDiversRows] = useState<{ id: string, label: string }[]>([]);

  // Modal Add Row State
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const [newRowName, setNewRowName] = useState('');

  // --- Logic : Building Dynamic Grid ---
  const sections = useMemo<SectionConfig[]>(() => {
    const prescriptionSections: SectionConfig[] = [];
    
    // Globally filter prescriptions if Active Only is enabled
    const visiblePrescriptions = activeOnly 
         ? allPrescriptions.filter(p => p.status !== 'STOPPED')
         : allPrescriptions;

    // Build prescription sections based on care categories
    const categories = [
      { id: 'medication', title: 'Médicaments', icon: Pill, color: 'text-blue-600', filter: (p: Prescription) => !p.data.prescriptionType || p.data.prescriptionType === 'medication' },
      { id: 'biology', title: 'Biologie', icon: FlaskConical, color: 'text-purple-600', filter: (p: Prescription) => p.data.prescriptionType === 'biology' },
      { id: 'imagery', title: 'Imagerie', icon: ScanLine, color: 'text-indigo-600', filter: (p: Prescription) => p.data.prescriptionType === 'imagery' },
      { id: 'care', title: 'Actes & Soins', icon: Stethoscope, color: 'text-emerald-600', filter: (p: Prescription) => p.data.prescriptionType === 'care' },
      { id: 'transfusion', title: 'Transfusions', icon: Droplet, color: 'text-rose-600', filter: (p: Prescription) => p.data.prescriptionType === 'transfusion' },
    ];

    const survStart = new Date(selectedDate);
    survStart.setHours(8, 0, 0, 0); // Replaced START_HOUR
    const survEnd = new Date(survStart);
    survEnd.setDate(survEnd.getDate() + 1);

    const isPrescriptionVisible = (p: Prescription) => {
      // Direct check against backend timeline events for the loaded 72h window
      return timelineEvents.some(te => te.prescriptionId === p.id);
    };

    categories.forEach(cat => {
      let matchingPrescriptions = visiblePrescriptions;
      
      if (cat.id === 'medication') {
        matchingPrescriptions = visiblePrescriptions.filter(p => (!p.data.prescriptionType || p.data.prescriptionType === 'medication') && isPrescriptionVisible(p));
      } else {
        matchingPrescriptions = visiblePrescriptions.filter(p => p.data.prescriptionType === cat.id && isPrescriptionVisible(p));
      }
      
      matchingPrescriptions.sort((a, b) => {
          const dataA = a.data as any;
          const dataB = b.data as any;
          const catA = dataA.careCategory || 'Z_Autre';
          const catB = dataB.careCategory || 'Z_Autre';
          if (catA !== catB) return catA.localeCompare(catB);
          
          const nameA = dataA.commercialName || '';
          const nameB = dataB.commercialName || '';
          return nameA.localeCompare(nameB);
      });

      if (matchingPrescriptions.length > 0) {
        let mappedRows = matchingPrescriptions.map(p => {
          const data = p.data;
          const isNonSubstitutable = !data.substitutable && (!data.prescriptionType || data.prescriptionType === 'medication');

            // Helper to generate full natural language schedule description
            const generateFullScheduleDescription = (s: any, type?: string) => {
              // Specific logic for Exam/Care types to match PrescriptionCard
              if (type === 'biology' || type === 'imagery' || type === 'care') {
                if (!s || !s.startDateTime) return '';
                const startDate = new Date(s.startDateTime);
                const dateStr = startDate.toLocaleDateString('fr-FR');
                const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                // Punctual / One-time -> simplified "À faire le..."
                if (data.schedule_type === 'one-time') {
                  return `À faire le ${dateStr} à ${timeStr}`;
                }

                // Frequency logic for exams (copied from PrescriptionCard)
                let freqText = "";
                if (s.dailySchedule === 'everyday') freqText = "Tous les jours";
                else if (s.dailySchedule === 'every-other-day') freqText = "Un jour sur deux";
                else if (s.dailySchedule === 'specific-days' && s.selectedDays?.length) {
                  freqText = `Les ${s.selectedDays.join(', ')}`;
                }

                let modeText = "";
                if (s.mode === 'simple' && s.simpleCount) {
                  const period = s.simplePeriod === 'day' ? 'jour' : (s.simplePeriod === 'week' ? 'semaine' : 'mois');
                  modeText = `${s.simpleCount} fois par ${period}`;
                } else if (s.mode === 'cycle' && s.interval) {
                  modeText = `toutes les ${s.interval}h`;
                } else if (s.mode === 'specific-time' && s.specificTimes?.length) {
                  modeText = `à ${s.specificTimes.join(', ')}`;
                }

                let durationText = "";
                if (s.durationValue && s.durationUnit) {
                  let unit = s.durationUnit;
                  if (unit === 'days') unit = 'jours';
                  if (unit === 'weeks') unit = 'semaines';
                  if (unit === 'months') unit = 'mois';
                  durationText = `pendant ${s.durationValue} ${unit}`;
                }

                const startText = `à partir du ${dateStr} à ${timeStr}`;
                let fullText = [freqText, modeText, durationText, startText].filter(Boolean).join(', ');
                return fullText.charAt(0).toUpperCase() + fullText.slice(1);
              }

              // Default / Medication Logic
              const parts: string[] = [];

              // 1. Daily Pattern
              if (s.dailySchedule === 'everyday') parts.push("Tous les jours");
              else if (s.dailySchedule === 'every-other-day') parts.push("Un jour sur deux");
              else if (s.dailySchedule === 'specific-days' && s.selectedDays?.length) {
                const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                // Assuming selectedDays are '0', '1'... or similar, map if needed. If string names, join.
                // If stored as numbers/strings '1'-'7'
                parts.push(`Les jours: ${s.selectedDays.join(', ')}`);
              }

              // 2. Intra-day Pattern
              if (s.mode === 'cycle' && s.interval) {
                parts.push(`toutes les ${s.interval}h`);
              } else if (s.mode === 'specific-time' && s.specificTimes?.length) {
                parts.push(`à ${s.specificTimes.join(', ')}`);
              } else if (s.mode === 'simple' && s.simpleCount) {
                const period = s.simplePeriod === 'day' ? 'jour' : (s.simplePeriod === 'week' ? 'semaine' : 'mois');
                parts.push(`${s.simpleCount} fois par ${period}`);
              }

              // 3. Duration
              if (s.durationValue && s.durationUnit) {
                let unit = s.durationUnit;
                if (unit === 'days') unit = 'jours';
                if (unit === 'weeks') unit = 'semaines';
                if (unit === 'months') unit = 'mois';
                parts.push(`pendant ${s.durationValue} ${unit}`);
              }

              // 4. Start Date
              if (s.startDateTime) {
                const d = new Date(s.startDateTime);
                parts.push(`à partir du ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
              }

              return parts.join(', ');
            };

            const fullScheduleText = generateFullScheduleDescription(data.schedule, data.prescriptionType);
            // No frontend slot calculation needed, timelineEvents maps directly

            const isMedication = !data.prescriptionType || data.prescriptionType === 'medication';

            const isAct = data.prescriptionType === 'biology' || data.prescriptionType === 'imagery' || data.prescriptionType === 'care';

            const TRANSFUSION_PRODUCT_MAPPING: Record<string, string> = {
                CGR: 'Concentré de Globules Rouges',
                PFC: 'Plasma Frais Congelé',
                CPA: 'Concentré Plaquettaire'
            };

            const rowLabel = isAct
                ? (data.libelle_sih || 'Examen/Acte Inconnu') 
                : (data.prescriptionType === 'transfusion' ? (TRANSFUSION_PRODUCT_MAPPING[data.blood_product_type as string] || data.blood_product_type || data.molecule) : (data.commercialName || 'Produit Inconnu'));

            // THE LEFT COLUMN METADATA: Content for the sticky left column
            const epicHeader = (
              <div className="flex w-full h-full overflow-hidden relative group">
                {/* Main Content Area */}
                <div className="flex flex-col items-start justify-center flex-1 px-3 py-1.5 min-w-0 pr-2 relative">
                  {/* Line 1 & 2: Expandable Name and Molecule badge */}
                  <ExpandableNameBadge name={rowLabel} molecule={data.molecule} />
                  
                  {/* Line 3: Dose, Route, Specs */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 w-full text-[12px] mt-1 pr-1">
                    {data.prescriptionType === 'transfusion' ? (
                       <span className="font-bold text-emerald-600">
                         {data.qty} {(() => {
                           if (!data.unit_id) return data.unit || 'poche(s)';
                           const u = unitsList.find(u => u.id === data.unit_id);
                           if (!u) return data.unit || 'poche(s)';
                           return Number(data.qty) > 1 ? (u.plural_label || u.label) : u.label;
                         })()}
                       </span>
                    ) : (data.qty || data.unit) && isMedication && (
                       <span className="font-bold text-emerald-600">
                         {data.qty}{data.unit}
                       </span>
                    )}
                    {data.route && (
                       <span className="text-slate-600 font-bold uppercase">
                         {routes.find(r => r.id === data.route)?.label || data.route}
                       </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-0.5 mt-1.5 w-full">
                    {isNonSubstitutable && (
                      <span className="flex items-center text-red-500 font-semibold text-[11px] uppercase">
                        <Ban size={12} className="mr-1 shrink-0" strokeWidth={2.5} />
                        NON SUBSTITUABLE
                      </span>
                    )}
                    {data.adminDuration && data.adminMode !== 'instant' && (
                      <span className="flex items-center text-blue-600 font-medium text-[11px]">
                        <Hourglass size={12} className="mr-1 shrink-0" strokeWidth={2} />
                        Durée d'administration: {data.adminDuration}
                      </span>
                    )}
                    {data.dilutionRequired && data.solvent && (
                      <span className="flex items-center text-fuchsia-500 font-medium text-[11px]">
                        <Syringe size={12} className="mr-1 shrink-0" strokeWidth={2} />
                        Diluer dans {data.solvent.qty} {data.solvent.unit || 'mL'} {data.solvent.commercialName || data.solvent.molecule || 'Solvant'}
                      </span>
                    )}
                  </div>
                  
                  {/* Note block if exists */}
                  {data.conditionComment && (
                    <div className="text-[11px] text-amber-700 flex items-start mt-1 w-full">
                      <FileText size={12} className="mr-1 mt-[2px] shrink-0" />
                      <span className="font-medium italic leading-tight truncate">{data.conditionComment}</span>
                    </div>
                  )}
                </div>

                {/* Right Action Icons Container (Vertical Strip) */}
                <div className="flex flex-col items-center justify-center shrink-0 border-l border-slate-200 px-3 gap-2">
                  {p.status === 'STOPPED' ? (
                     <span className="text-[10px] text-red-600 font-bold uppercase rotate-[-90deg] tracking-widest my-4">Arrêt</span>
                  ) : p.status === 'PAUSED' ? (
                     <>
                        <button onClick={() => handleResumePrescription(p.id)} title="Reprendre" className="text-emerald-500 hover:text-white border-2 border-emerald-500 hover:bg-emerald-500 w-[24px] h-[24px] rounded-full flex items-center justify-center transition-colors">
                          <CheckCircle2 size={14} strokeWidth={2.5}/>
                        </button>
                        <button onClick={() => setStopModal({ isOpen: true, prescriptionId: p.id })} title="Arrêter" className="text-white hover:bg-red-600 bg-red-500 w-[24px] h-[24px] rounded-full flex items-center justify-center shadow-sm transition-colors border-2 border-red-500">
                           <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>
                        </button>
                     </>
                  ) : (
                     <>
                        <button onClick={() => handlePausePrescription(p.id)} title="Mettre en pause" className="text-white bg-blue-500 hover:bg-blue-600 w-[24px] h-[24px] rounded-full flex items-center justify-center shadow-sm transition-colors">
                          <Pause size={12} fill="currentColor" strokeWidth={0}/>
                        </button>
                        <button onClick={() => setStopModal({ isOpen: true, prescriptionId: p.id })} title="Arrêter" className="text-red-500 border-2 border-red-500 hover:bg-red-50 w-[24px] h-[24px] rounded-full flex items-center justify-center transition-colors">
                           <div className="w-2 h-2 bg-red-500 rounded-sm"></div>
                        </button>
                     </>
                  )}
                </div>
              </div>
            );

            let bgColor = 'bg-white';
            let hoverBg = 'group-hover:bg-blue-50';

            if (p.status === 'STOPPED') {
                bgColor = 'bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.05),rgba(0,0,0,0.05)_10px,transparent_10px,transparent_20px)] bg-gray-50';
                hoverBg = ''; // Stopped rows are totally inert
            } else if (p.status === 'PAUSED') {
                bgColor = 'bg-amber-50';
                hoverBg = 'group-hover:bg-amber-100';
            }

            return {
              id: p.id,
              label: rowLabel, // defensive fallback
              epicHeader,
              type: 'prescription_timeline' as const,
              prescriptionId: p.id,
              prescriptionData: p.data,
              status: p.status,
              bgColor,
              hoverBg
            };
        });

        if (cat.id === 'medication') {
           const groupedRows: any[] = [];
           let currentCat = '';
           mappedRows.forEach((row, i) => {
               const pCat = (matchingPrescriptions[i].data as any).careCategory || 'Z_Autre';
               if (pCat !== currentCat) {
                   groupedRows.push({
                       id: `subheader-${pCat}`,
                       isSubheader: true,
                       label: pCat === 'Z_Autre' ? 'AUTRES MÉDICAMENTS' : pCat,
                   });
                   currentCat = pCat;
               }
               groupedRows.push(row);
           });
           mappedRows = groupedRows;
        }

        prescriptionSections.push({
          id: cat.id,
          title: cat.title,
          icon: cat.icon,
          color: cat.color,
          rows: mappedRows
        });
      }
    });

    const activeFlowsheet = flowsheets.find(f => f.id === activeFlowsheetId);
    let flowsheetSections: SectionConfig[] = [];
    
    if (activeFlowsheet && activeFlowsheet.groups) {
      flowsheetSections = activeFlowsheet.groups.map((g: any) => ({
        id: g.id,
        title: g.label || g.name,
        icon: Activity, // Provide a default icon
        color: 'text-slate-700',
        rows: (g.parameters || []).map((p: any) => {
          
          let rowType = p.valueType?.toLowerCase() === 'boolean' ? 'checkbox' : p.options ? 'select' : ['number', 'numeric'].includes(p.valueType?.toLowerCase()) ? 'number' : 'text';
          let computeSource = undefined;

          if (p.code === 'HYDRIC_INPUT_CUM') {
              rowType = 'computed';
              computeSource = 'HYDRIC_INPUT';
          } else if (p.code === 'HYDRIC_OUTPUT_CUM') {
              rowType = 'computed';
              computeSource = 'HYDRIC_OUTPUT';
          } else if (p.code === 'HYDRIC_BALANCE_CUM') {
              rowType = 'computed';
              computeSource = 'HYDRIC_BALANCE';
          }

          return {
              parameterId: p.id,
              id: p.code,
              label: p.label || p.name,
              epicHeader: (
                <div className="flex w-full items-center justify-between font-bold text-gray-700 text-[11px] px-2 py-1 leading-tight">
                  <span className="truncate">{p.label || p.name}</span>
                  {p.unit && <span className="text-[9px] text-gray-400 font-normal ml-2">{p.unit}</span>}
                </div>
              ),
              epicSubtext: <span className="w-0 h-0 block" />, 
              unit: p.unit, 
              type: rowType as any,
              computeSource,
              options: p.options,
              normalMin: p.normalMin,
              normalMax: p.normalMax,
              warningMin: p.warningMin,
              warningMax: p.warningMax,
              hardMin: p.hardMin,
              hardMax: p.hardMax,
              source: p.source
          } as RowConfig;
        })
      }));
    }

    return [...prescriptionSections, ...flowsheetSections];
  }, [allPrescriptions, selectedDate, flowsheets, activeFlowsheetId, drainCount, redonCount, customDiversRows, timelineEvents, activeOnly]);

  // --- Calculations ---

  const calculateCumul = (sourceRowId: string, currentIso: string): number => {
    let total = 0;
    const hourIndex = timeSlots.findIndex(t => t.iso === currentIso);
    if (hourIndex === -1) return 0;

    // Standard Horizontal Cumul up to current hour
    for (let i = 0; i <= hourIndex; i++) {
      const slotIso = timeSlots[i].iso;
      const val = parseFloat(currentDayData[sourceRowId]?.[slotIso] as string || '0');
      if (!isNaN(val)) total += val;
    }
    return total;
  };

  const calculateBilanHoraire = (iso: string): number => {
    let inputs = 0;
    let outputs = 0;

    // Scan all configured rows in sections to identify inputs/outputs dynamically
    sections.forEach(sec => sec.rows.forEach(row => {
      const val = parseFloat(currentDayData[row.id]?.[iso] as string || '0');
      if (!isNaN(val)) {
        if (row.isInput) inputs += val;
        if (row.isOutput) outputs += val;
      }
    }));

    // Add Apports manually if needed from other logic
    const apports = parseFloat(currentDayData['apports_total']?.[iso] as string || '0');
    if (!isNaN(apports)) inputs += apports;

    return inputs - outputs;
  };

  const handleLocalChange = (rowId: string, slotIso: string, value: any) => {
    // Optimistic Update (Instant, purely local)
    setAllData(prev => ({
      ...prev,
      [dateKey]: {
        ...(prev[dateKey] || {}),
        [rowId]: {
          ...(prev[dateKey]?.[rowId] || {}),
          [slotIso]: value
        }
      }
    }));
  };

  const handleCommit = async (rowId: string, slotIso: string, value: any) => {
    if (!patientId) return;

    // Find the parameter UUID assigned to this row (rowId is the parameterCode)
    let parameterId = '';
    for (const sec of sections) {
        const found = sec.rows.find(r => r.id === rowId);
        if (found && found.parameterId) {
            parameterId = found.parameterId;
            break;
        }
    }

    console.log("FicheSurveillance handleCommit payload:", {
      patientId,
      rowId,
      parameterId,
      slotIso,
      value
    });

    try {
      await api.updateSurveillanceCell(patientId, {
        tenantPatientId: patientId, // This might actually be the admission's patient UUID if passed from dossier
        parameterId: parameterId,
        parameterCode: rowId, 
        recordedAt: slotIso,
        value: value === '' ? null : value
      });
      fetchWindowData(); // Instantly visually refresh the UI to display Hydric calculations mathematically aggregated
    } catch (e: any) {
      console.error("Failed to commit cell", e);
      // Rollback local state ideally here if we had pristine tracking
    }
  };

  const copyPreviousColumn = (targetIso: string) => {
    const targetIndex = timeSlots.findIndex(t => t.iso === targetIso);
    if (targetIndex <= 0) return;
    const prevIso = timeSlots[targetIndex - 1].iso;
    const newDayData = { ...currentDayData };

    // Copy logic (simplified)
    Object.keys(currentDayData).forEach(rowId => {
      if (currentDayData[rowId]?.[prevIso] !== undefined) {
        if (!newDayData[rowId]) newDayData[rowId] = {};
        newDayData[rowId][targetIso] = currentDayData[rowId][prevIso];
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
      const id = `divers_custom_${Date.now()} `;
      setCustomDiversRows(prev => [...prev, { id, label: newRowName.trim() }]);
      setIsAddRowModalOpen(false);
    }
  };

  const handlePausePrescription = async (id: string) => {
    if (!window.confirm("Voulez-vous suspendre cette prescription ?")) return;
    try {
      await api.pausePrescription(id);
      setAllPrescriptions(prev => prev.map(p => p.id === id ? { ...p, status: 'PAUSED' } : p));
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };

  const handleResumePrescription = async (id: string) => {
    try {
      await api.resumePrescription(id);
      setAllPrescriptions(prev => prev.map(p => p.id === id ? { ...p, status: 'ACTIVE' } : p));
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };

  const handleStopPrescription = async (id: string, reason: string) => {
    try {
      await api.stopPrescription(id, reason);
      const stoppedIso = new Date().toISOString();
      setAllPrescriptions(prev => prev.map(p => p.id === id ? { ...p, status: 'STOPPED', stopped_at: stoppedIso } : p));
      setStopModal({ isOpen: false, prescriptionId: '' });
    } catch (err: any) {
      alert("Erreur: " + err.message);
    }
  };

  const handleSaveAdministration = async (prescriptionId: string, eventId: string, slotTime: string, payload: AdministrationSavePayload | AdministrationSavePayload[]) => {
    if (!user?.id) {
      alert("Authentication context missing. Please refresh.");
      return;
    }
    if (!patientId || !prescriptionId) return;

    const pDate = new Date(slotTime);

    try {
      const payloads = Array.isArray(payload) ? payload : [payload];
      
      for (const p of payloads) {
        if (p.anchor_prescription_event_id && p.selected_prescription_event_ids) {
            await api.recordBiologyExecution({
                action_type: p.action_type,
                occurred_at: p.occurred_at,
                actual_start_at: p.actual_start_at,
                actual_end_at: p.actual_end_at,
                justification: p.justification,
                anchor_prescription_event_id: p.anchor_prescription_event_id,
                selected_prescription_event_ids: p.selected_prescription_event_ids
            });
        } else {
            await api.recordExecution(prescriptionId, {
               prescriptionId: prescriptionId,
               assigned_prescription_event_id: eventId,
               patientId: patientId, // Fallback if recordExecution expects it
               action_type: p.action_type,
               occurred_at: p.occurred_at,
               actual_start_at: p.actual_start_at,
               actual_end_at: p.actual_end_at,
               planned_date: pDate.toISOString(),
               justification: p.justification,
               transfusion: p.transfusion,
               administered_bags: p.administered_bags,
               linked_event_id: p.linked_event_id,
               volume_administered_ml: p.volume_administered_ml
            });
        }
      }

      // Refetch events
      if (activeFlowsheetId && timeSlots.length > 0) {
          const survStart = new Date(timeSlots[0].iso);
          const survEnd = new Date(timeSlots[timeSlots.length - 1].iso);
          survEnd.setHours(survEnd.getHours() + 1); 

          const res = await api.getSurveillanceTimeline(patientId, {
            flowsheetId: activeFlowsheetId,
            fromDate: survStart.toISOString(),
            toDate: survEnd.toISOString()
          });
          setTimelineEvents(res.timelineEvents);
      }
      
      // Explicitly trigger a fresh poll of the JSON buckets 
      // otherwise mathematically aggregated admin volumes remain hidden graphically until 30s timeout
      
      // We close the modal to let the user see the updated timeline grid cell
      // We don't touch the modal state here anymore, it's done by the portal.
    } catch (err: any) {
      console.error("Error saving execution", err);
      alert("Error: " + err.message);
    }
  };

  const timeToPx = useCallback((timeTs: number, timelineStartTs: number) => {
      const minutesFromStart = (timeTs - timelineStartTs) / 60000;
      const pixelsPerMinute = 80 / 60; // 80px column width exactly
      return minutesFromStart * pixelsPerMinute;
  }, []);

  const getDurationMinsLocal = (duration: any): number => {
      if (!duration) return 0;
      if (typeof duration === 'number') return duration;
      if (typeof duration === 'object') {
          // PostgreSQL INTERVAL parsing handles { hours: 2, minutes: 30 }
          const h = typeof duration.hours === 'number' ? duration.hours : 0;
          const m = typeof duration.minutes === 'number' ? duration.minutes : 0;
          return (h * 60) + m;
      }
      if (typeof duration === 'string') {
          if (duration === '0' || duration === '00:00:00') return 0;
          if (duration.includes(':')) {
              const [h, m] = duration.split(':');
              return (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
          }
          return parseInt(duration) || 0;
      }
      return 0;
  };

  const renderPrescriptionTimelineRow = (row: RowConfig) => {
      if (!row.prescriptionData || timeSlots.length === 0) return null;

      const timelineStartTs = new Date(timeSlots[0].iso).getTime();
      const timelineEndTs = new Date(timeSlots[timeSlots.length - 1].iso).getTime() + 3600000;
      const totalDuration = timelineEndTs - timelineStartTs;

      const rowEvents = timelineEvents.filter(te => te.prescriptionId === row.prescriptionId);
      
      const infusions = rowEvents.filter(te => getDurationMinsLocal(te.adminDuration) > 0);
      const instants = rowEvents.filter(te => getDurationMinsLocal(te.adminDuration) === 0);

      infusions.sort((a,b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime());
      
      const eventTracks = new Map<string, number>();
      const trackEnds: number[] = [];
      infusions.forEach((evt, idx) => {
          const evtId = evt.eventId || `evt-${idx}`;
          const duration = getDurationMinsLocal(evt.adminDuration);
          const pS = new Date(evt.plannedDate).getTime();
          const pE = pS + duration * 60000;
          let aS = pS;
          let aE = pE;
          const sEv = evt.administrationEvents?.find((e: any) => e.action_type === 'started' && e.status === 'ACTIVE');
          const eEv = evt.administrationEvents?.find((e: any) => e.action_type === 'ended' && e.status === 'ACTIVE');
          if (sEv) {
              aS = new Date(sEv.actual_start_at).getTime();
              aE = eEv && eEv.actual_end_at ? new Date(eEv.actual_end_at).getTime() : Date.now();
          }
          const oS = Math.min(pS, aS);
          const oE = Math.max(pE, aE);
          
          let t = 0;
          while (t < trackEnds.length && trackEnds[t] > oS) {
              t++;
          }
          trackEnds[t] = oE;
          eventTracks.set(evtId, t);
      });

      const maxTrack = Math.max(1, trackEnds.length); // at least 1 track container to render

      // --- Bolus Overlap Check (Point Collisions) ---
      // Deduplicate instants by plannedDate because a single scheduled event 
      // might have been joined natively to multiple administration events.
      // We want exactly 1 scheduled dot per scheduled time!
      const uniqueInstantsMap = new Map<string, typeof instants[0]>();
      instants.forEach(te => {
          const key = te.eventId ? String(te.eventId) : te.plannedDate;
          if (!uniqueInstantsMap.has(key)) {
              // Copy the object so we can safely merge administrationEvents
              uniqueInstantsMap.set(key, { ...te, administrationEvents: te.administrationEvents ? [...te.administrationEvents] : [] });
          } else {
              // Merge administration events onto the unique item
              const existing = uniqueInstantsMap.get(key)!;
              if (te.administrationEvents && te.administrationEvents.length > 0) {
                  existing.administrationEvents = [
                      ...(existing.administrationEvents || []),
                      ...te.administrationEvents
                  ];
              }
          }
      });
      const uniqueInstants = Array.from(uniqueInstantsMap.values());

      const scheduledXs: number[] = [];

      const processedInstantsBase = uniqueInstants.map((te) => {
          const pStartTs = new Date(te.plannedDate).getTime();
          const pLeft = timeToPx(pStartTs, timelineStartTs);
          scheduledXs.push(pLeft);

          const sortedAEvs = [...(te.administrationEvents || [])].sort((a, b) => 
              new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
          );
          
          const terminalEv = sortedAEvs.find(e => (e.action_type === 'administered' || e.action_type === 'refused') && e.status === 'ACTIVE');

          if (!terminalEv) {
              return { te, type: 'pending', pStartTs, pLeft };
          }

          const actualTs = terminalEv.actual_start_at ? new Date(terminalEv.actual_start_at).getTime() : new Date(terminalEv.occurred_at).getTime();
          const deltaMin = (actualTs - pStartTs) / 60000;
          const aLeft = timeToPx(actualTs, timelineStartTs);

          if (Math.abs(deltaMin) <= 30) {
              return { te, type: 'on-time', terminalEv, pStartTs, pLeft, actualTs, aLeft, deltaMin };
          }

          return { te, type: 'deviated', terminalEv, pStartTs, pLeft, actualTs, aLeft, deltaMin };
      });

      const lateDeviationsUnassigned = processedInstantsBase.filter(i => i.type === 'deviated' && i.deltaMin! > 0);
      const earlyDeviationsUnassigned = processedInstantsBase.filter(i => i.type === 'deviated' && i.deltaMin! < 0);

      // Icon width (e.g., 28px) mapped to percent approx. 
      // Timeline width is large, but to be safe let's use approx 3.5% = ~35px gap
      // This is a dynamic percentage-based collision rather than pixel-based to match `pLeft`/`aLeft`.
      const MIN_PERCENT_SEP = 3.5; 

      const lateWithLanes = assignPointLanes(lateDeviationsUnassigned as any[], {
          xOf: d => (d as any).aLeft,
          // Ignore it's own scheduled dot when collisions!
          fixedXsOf: d => scheduledXs.filter(sx => sx !== (d as any).pLeft),
          minSeparationPx: MIN_PERCENT_SEP
      });

      const earlyWithLanes = assignPointLanes(earlyDeviationsUnassigned as any[], {
          xOf: d => (d as any).aLeft,
          // Ignore it's own scheduled dot when collisions!
          fixedXsOf: d => scheduledXs.filter(sx => sx !== (d as any).pLeft),
          minSeparationPx: MIN_PERCENT_SEP
      });

      // Increase spacing as requested by the user
      const VERTICAL_STEP = 34;
      const baseTracksHeight = maxTrack * 38 + (maxTrack - 1) * 6 + 16;
      const BASE_HEIGHT = Math.max(72, baseTracksHeight);
      
      const maxLateLane = lateWithLanes.length > 0 ? Math.max(...lateWithLanes.map(i => i.lane)) + 1 : 0;
      const maxEarlyLane = earlyWithLanes.length > 0 ? Math.max(...earlyWithLanes.map(i => i.lane)) + 1 : 0;

      const topExtra = maxLateLane * VERTICAL_STEP;
      const bottomExtra = maxEarlyLane * VERTICAL_STEP;
      const computedHeight = BASE_HEIGHT + topExtra + bottomExtra;

      // Reconstruct merged array with lane data
      const processedInstants = processedInstantsBase.map(item => {
          if (item.type === 'deviated') {
              if (item.deltaMin! > 0) return lateWithLanes.find(a => a.te === item.te)!;
              return earlyWithLanes.find(a => a.te === item.te)!;
          }
          return item; // pending or on-time
      });

      const formatDelta = (minutes: number) => {
          const absMin = Math.abs(minutes);
          if (absMin < 60) return ''; 
          const h = Math.floor(absMin / 60);
          const m = Math.floor(absMin % 60);
          return m > 0 ? `${h}h${m}` : `${h}h`;
      };

      const getIconInst = (ev: any, isPending: boolean, isSkipped: boolean = false) => {
          if (isSkipped) return (
              <div 
                  className="w-6 h-6 rounded-full shadow-inner border border-gray-400 cursor-not-allowed pointer-events-auto z-10 relative opacity-80"
                  style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(156, 163, 175, 0.5) 3px, rgba(156, 163, 175, 0.5) 6px)',
                      backgroundColor: 'rgba(243, 244, 246, 0.9)'
                  }}
                  title="Dose sautée"
              />
          );
          if (isPending || !ev) return <div className="w-6 h-6 rounded-full bg-gray-300 pointer-events-auto cursor-pointer shadow-sm border border-gray-400"></div>;
          if (ev.action_type === 'administered') return <CheckCircle2 size={28} className="text-emerald-500 bg-white rounded-full pointer-events-auto cursor-pointer shadow-sm relative z-10" />;
          if (ev.action_type === 'refused') return <XCircle size={28} className="text-red-500 bg-white rounded-full pointer-events-auto cursor-pointer shadow-sm relative z-10" />;
          return null;
      };

      return (
        <tr key={row.id} className={`group transition-colors ${row.bgColor || 'bg-white'}`}>
             <td className={`align-middle p-0 sticky left-0 z-30 border-r border-b border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors ${row.bgColor || 'bg-white'} ${row.hoverBg !== undefined ? row.hoverBg : 'group-hover:bg-blue-50'} ${row.textColor || ''} w-[300px] min-w-[300px] max-w-[300px] relative`} style={{ height: computedHeight }}>
                 {/* Pause Left Accent Border */}
                 {row.status === 'PAUSED' && (
                     <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-amber-500 z-40"></div>
                 )}
                 {/* Stopped Opacity Overlay */}
                 <div className={`w-full h-full ${row.status === 'STOPPED' ? 'opacity-60 grayscale' : ''}`}>
                    {row.epicHeader}
                 </div>
             </td>
             <td colSpan={timeSlots.length} className={`p-0 border-b border-gray-200 align-middle overflow-hidden transition-colors ${row.hoverBg !== undefined ? row.hoverBg : 'group-hover:bg-blue-50'}`}>
                 <div className="relative w-full h-full overflow-hidden" style={{ height: computedHeight }}>
                     {/* Background Grid Underlay */}
                     <div className="absolute inset-0 flex pointer-events-none z-0">
                     {timeSlots.map((slot) => {
                         const isExtraBorder = slot.isMidnight || slot.isStartOfDay;
                         return (
                             <div key={`grid-${slot.iso}`} className={`w-[80px] min-w-[80px] shrink-0 border-r border-gray-200 h-full ${slot.iso === currentHourLabel ? 'bg-emerald-50/40 ring-1 ring-inset ring-emerald-100' : ''} ${isExtraBorder ? 'border-r-2 border-r-gray-400' : ''}`} />
                         );
                     })}
                 </div>

                 {/* Foreground Overlay Container */}
                 <div className="relative z-10 flex flex-col justify-center gap-[6px] py-2 w-full">
                    {/* Render Tracks */}
                    {Array.from({length: maxTrack}).map((_, trackIdx) => {
                        return (
                            <div key={`track-${trackIdx}`} className="relative w-full h-[38px]">
                                {infusions.filter(te => (eventTracks.get(te.eventId || `evt-${infusions.indexOf(te)}`) || 0) === trackIdx).map((te) => {
                                    const durationMins = getDurationMinsLocal(te.adminDuration);
                                    const evtId = te.eventId || `evt-${infusions.indexOf(te)}`;
                                    
                                    const pStartTs = new Date(te.plannedDate).getTime();
                                    const pEndTs = pStartTs + durationMins * 60000;
                                    
                                    const startedEv = te.administrationEvents?.find((e: any) => e.action_type === 'started' && e.status === 'ACTIVE');
                                    const endedEv = te.administrationEvents?.find((e: any) => e.action_type === 'ended' && e.status === 'ACTIVE');
                                    const refusedEv = te.administrationEvents?.find((e: any) => e.action_type === 'refused' && e.status === 'ACTIVE');
                                    
                                    const pLeft = timeToPx(pStartTs, timelineStartTs);
                                    const pWidth = timeToPx(pEndTs, timelineStartTs) - pLeft;

                                    const isOngoing = startedEv && !endedEv;
                                    let aBar = null;
                                    
                                    if (refusedEv) {
                                        aBar = (
                                            <div key={`${evtId}-refused`}
                                                className="absolute cursor-pointer transition-colors shadow-sm border border-red-500 rounded-[1px]"
                                                style={{ 
                                                    left: `${pLeft}px`, 
                                                    width: `${pWidth}px`,
                                                    height: '14px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    zIndex: 20,
                                                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(239, 68, 68, 0.4) 4px, rgba(239, 68, 68, 0.4) 8px)',
                                                    backgroundColor: 'rgba(254, 226, 226, 0.5)'
                                                }}
                                                title={`Perfusion refusée à ${new Date(refusedEv.occurred_at).toLocaleTimeString()}`}
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if (row.prescriptionData?.status !== 'PAUSED' && row.prescriptionData?.status !== 'STOPPED') {
                                                        dispatch.openAdminModal({
                                                            prescriptionId: row.prescriptionId!,
                                                            eventId: te.eventId || te.id,
                                                            prescriptionName: row.prescriptionData?.commercialName || '',
                                                            slotTime: te.plannedDate,
                                                            duration: durationMins,
                                                            requiresEndEvent: te.requires_end_event || false,
                                                            requiresFluidInfo: te.requires_fluid_info || false,
                                                            activePerfusionEvent: null,
                                                            historyEvents: te.administrationEvents || [],
                                                            isTransfusion: row.prescriptionData?.prescriptionType === 'transfusion',
                                                            isBiology: row.prescriptionData?.prescriptionType === 'biology'
                                                        });
                                                    }
                                                }}
                                            />
                                        );
                                    } else if (startedEv) {
                                        const aStartExact = new Date(startedEv.actual_start_at || startedEv.occurred_at).getTime();
                                        const aEndExact = endedEv && (endedEv.actual_end_at || endedEv.occurred_at) ? new Date(endedEv.actual_end_at || endedEv.occurred_at).getTime() : Date.now();

                                        const aLeft = timeToPx(aStartExact, timelineStartTs);
                                        const aWidth = Math.max(1, timeToPx(aEndExact, timelineStartTs) - aLeft);
                                        
                                        const pRight = pLeft + pWidth;
                                        const aRight = aLeft + aWidth;

                                        aBar = (
                                            <div key={`${evtId}-actual-container`} className="absolute" style={{ left: 0, top: '50%', width: '100%', height: 0, zIndex: 20 }}>
                                                {/* Left Dashed Connector */}
                                                {aLeft < pLeft && (
                                                    <div className="absolute" style={{ left: 0, top: 0, height: '36px', transform: 'translateY(-50%)' }}>
                                                        {/* Top Dashed line */}
                                                        <div className="absolute border-t-2 border-dashed border-violet-500" 
                                                             style={{ left: `${aLeft}px`, width: `${pLeft - aLeft}px`, top: 0 }} />
                                                        {/* Bottom Dashed line */}
                                                        <div className="absolute border-b-2 border-dashed border-violet-500" 
                                                             style={{ left: `${aLeft}px`, width: `${pLeft - aLeft}px`, bottom: 0 }} />
                                                    </div>
                                                )}
                                                
                                                {/* Right Dashed Connector */}
                                                {!isOngoing && aRight > pRight && (
                                                    <div className="absolute" style={{ left: 0, top: 0, height: '36px', transform: 'translateY(-50%)' }}>
                                                        {/* Top Dashed line */}
                                                        <div className="absolute border-t-2 border-dashed border-violet-500" 
                                                             style={{ left: `${pRight}px`, width: `${aRight - pRight}px`, top: 0 }} />
                                                        {/* Bottom Dashed line */}
                                                        <div className="absolute border-b-2 border-dashed border-violet-500" 
                                                             style={{ left: `${pRight}px`, width: `${aRight - pRight}px`, bottom: 0 }} />
                                                    </div>
                                                )}
                                                
                                                {/* The Actual Administration Bar (Body) */}
                                                <div key={`${evtId}-actual`}
                                                    className={`absolute cursor-pointer transition-colors shadow-sm ${isOngoing ? 'animate-shimmer-sweep outline outline-violet-500' : 'bg-violet-600'} rounded-sm`}
                                                    style={{ 
                                                        left: `${aLeft}px`, 
                                                        width: `${aWidth}px`,
                                                        height: '20px',
                                                        top: '-10px',
                                                    }}
                                                    title={isOngoing ? `Perfusion en cours depuis ${new Date(aStartExact).toLocaleTimeString()}` : `Perfusion: ${new Date(aStartExact).toLocaleTimeString()} - ${new Date(aEndExact).toLocaleTimeString()}`}
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        console.log("Clicked prescription event:", te.eventId || te.id);
                                                        if (row.prescriptionData?.status !== 'PAUSED' && row.prescriptionData?.status !== 'STOPPED') {
                                                            dispatch.openAdminModal({
                                                                prescriptionId: row.prescriptionId!,
                                                                eventId: te.eventId || te.id,
                                                                prescriptionName: row.prescriptionData?.commercialName || '',
                                                                slotTime: te.plannedDate,
                                                                duration: durationMins,
                                                                requiresEndEvent: te.requires_end_event || false,
                                                                requiresFluidInfo: te.requires_fluid_info || false,
                                                                activePerfusionEvent: isOngoing ? startedEv : null,
                                                                historyEvents: te.administrationEvents || [],
                                                                isTransfusion: row.prescriptionData?.prescriptionType === 'transfusion',
                                                                isBiology: row.prescriptionData?.prescriptionType === 'biology'
                                                            });
                                                        }
                                                    }}
                                                >
                                                    {/* Tall Tick at aLeft (Start of Admin) */}
                                                    <div className="absolute top-1/2 left-0 w-[2px] bg-violet-600 transform -translate-y-1/2" style={{ height: '36px' }} />
                                                    
                                                    {/* Tall Tick at aRight (End of Admin) */}
                                                    {!isOngoing && (
                                                        <div className="absolute top-1/2 right-0 w-[2px] bg-violet-600 transform -translate-y-1/2" style={{ height: '36px' }} />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    const isSkipped = te.plan_status === 'SKIPPED';
                                    
                                    return (
                                        <React.Fragment key={`${evtId}-wrapper`}>
                                            <div key={`${evtId}-planned`}
                                                className={`absolute transition-all rounded-[2px] ${isSkipped ? 'border border-gray-400 opacity-80 cursor-not-allowed flex items-center justify-center overflow-hidden' : 'bg-gray-200 cursor-pointer hover:brightness-95'}`}
                                                style={{ 
                                                    left: `${pLeft}px`, 
                                                    width: `${pWidth}px`,
                                                    height: '36px', 
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    zIndex: isSkipped ? 5 : 10,
                                                    ...(isSkipped ? {
                                                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.5) 4px, rgba(156, 163, 175, 0.5) 8px)',
                                                        backgroundColor: 'rgba(243, 244, 246, 0.9)'
                                                    } : {})
                                                }}
                                                title={isSkipped ? 'Dose sautée' : `Prévu: ${new Date(te.plannedDate).toLocaleTimeString()} pour ${durationMins} min`}
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    if (isSkipped) return;
                                                    
                                                    console.log("Clicked prescription event:", te.eventId || te.id);
                                                    const status = row.status;
                                                    const isFuture = pStartTs > Date.now();
                                                    
                                                    // Stop Matrix: Block ALL new administrations
                                                    if (status === 'STOPPED') return;
                                                    
                                                    // Pause Matrix: Block FUTURE new administrations, unless ending active perfusion
                                                    if (status === 'PAUSED' && isFuture) return;

                                                    // Continue...
                                                        dispatch.openAdminModal({
                                                            prescriptionId: row.prescriptionId!,
                                                            eventId: te.eventId || te.id,
                                                            prescriptionName: row.prescriptionData?.commercialName || '',
                                                            slotTime: te.plannedDate,
                                                            duration: durationMins,
                                                            requiresEndEvent: te.requires_end_event || false,
                                                            requiresFluidInfo: te.requires_fluid_info || false,
                                                            activePerfusionEvent: isOngoing ? startedEv : null,
                                                            historyEvents: te.administrationEvents || [],
                                                            isTransfusion: row.prescriptionData?.prescriptionType === 'transfusion',
                                                            isBiology: row.prescriptionData?.prescriptionType === 'biology'
                                                        });
                                                }}
                                            >
                                                {isSkipped && pWidth > 40 && (
                                                    <span className="text-[10px] font-bold text-gray-400 rotate-[-10deg]">SAUTÉE</span>
                                                )}
                                            </div>
                                            {aBar}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        );
                    })}
                    
                    {/* Render Instants */}
                    {instants.length > 0 && (
                        <div className="absolute inset-0 pointer-events-none z-30">
                            {processedInstants.map((item: any, idx) => {
                                const openModal = (e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    console.log("Clicked prescription event:", item.te.eventId || item.te.id);
                                    
                                    const status = row.status;
                                    const isFuture = new Date(item.te.plannedDate).getTime() > Date.now();

                                    // Block explicitly per new strict matrix
                                    if (status === 'STOPPED') return;
                                    if (status === 'PAUSED' && isFuture) return;

                                                        dispatch.openAdminModal({
                                                            prescriptionId: row.prescriptionId!,
                                                            eventId: item.te.eventId || item.te.id,
                                                            prescriptionName: row.prescriptionData?.commercialName || '',
                                                            slotTime: item.te.plannedDate,
                                                            duration: 0,
                                                            requiresEndEvent: item.te.requires_end_event || false,
                                                            requiresFluidInfo: item.te.requires_fluid_info || false,
                                                            activePerfusionEvent: null,
                                                            historyEvents: item.te.administrationEvents || [],
                                                            isTransfusion: row.prescriptionData?.prescriptionType === 'transfusion',
                                                            isBiology: row.prescriptionData?.prescriptionType === 'biology'
                                                        });
                                                };

                                if (item.type === 'pending') {
                                    const isSkipped = item.te.plan_status === 'SKIPPED';
                                    const late = isSlotLate(item.te.plannedDate, undefined);
                                    let icon = late ? <AlertTriangle size={28} className="text-amber-500 animate-pulse bg-white rounded-full pointer-events-auto cursor-pointer shadow-sm" /> : getIconInst(null, true, isSkipped);
                                    if (isSkipped) { icon = getIconInst(null, true, true); }
                                    
                                    // Dim future dots on Paused rows
                                    const isFuture = new Date(item.te.plannedDate).getTime() > Date.now();
                                    const isDimmed = row.status === 'PAUSED' && isFuture;
                                    
                                    return (
                                        <div key={`inst-pending-${idx}`} className={`absolute -translate-y-1/2 -translate-x-1/2 ${isDimmed ? 'opacity-30' : ''}`} style={{ left: `${item.pLeft}px`, top: '50%'}}>
                                            <div onClick={isSkipped ? undefined : openModal} className={`pointer-events-auto ${row.status === 'STOPPED' || isDimmed || isSkipped ? 'cursor-not-allowed' : 'cursor-pointer'}`} title={isSkipped ? 'Dose sautée' : undefined}>{icon}</div>
                                        </div>
                                    );
                                }

                                if (item.type === 'on-time') {
                                    return (
                                        <div key={`inst-ontime-${idx}`} className="absolute -translate-y-1/2 -translate-x-1/2" style={{ left: `${item.pLeft}px`, top: '50%'}}>
                                             <div onClick={openModal} className="pointer-events-auto cursor-pointer">
                                                 {getIconInst(item.terminalEv, false)}
                                             </div>
                                        </div>
                                    );
                                }

                                // Deviated (Stacking Geometry - Point Collisions)
                                if (item.type === 'deviated') {
                                    const isLate = item.deltaMin! > 0;
                                    const leftPct = Math.min(item.pLeft, item.aLeft!);
                                    const widthPct = Math.abs(item.aLeft! - item.pLeft);
                                    
                                    const lane = item.lane || 0;
                                    
                                    // Late stacks up (-), early stacks down (+)
                                    const yOffsetPx = isLate ? -(lane * VERTICAL_STEP) : (lane * VERTICAL_STEP);

                                    const arrowLabel = formatDelta(item.deltaMin!);

                                    return (
                                        <React.Fragment key={`inst-dev-${idx}`}>
                                            {/* Scheduled Grey Dot - Always on the centerline */}
                                            <div className="absolute -translate-y-1/2 -translate-x-1/2 z-0" style={{ left: `${item.pLeft}px`, top: '50%'}}>
                                                 <div className="w-6 h-6 rounded-full bg-gray-200 border border-gray-300"></div>
                                            </div>

                                            {/* Dashed Connector - Runs strictly from scheduledX to actualX horizontally, at the final yOffsetPx */}
                                            <div className="absolute flex items-center justify-center pointer-events-none z-0"
                                                 style={{ 
                                                     left: `${leftPct}px`, 
                                                     width: `${widthPct}px`, 
                                                     height: '0px',
                                                     top: `calc(50% + ${yOffsetPx}px)` 
                                                 }}>
                                                {/* The line itself */}
                                                <div className="absolute w-full border-t border-dashed border-gray-400"></div>
                                                
                                                {/* Directional Arrowhead (Always points logically to actual event) */}
                                                <div className={`absolute border-t-4 border-b-4 border-transparent ${isLate ? 'border-l-4 border-l-gray-400' : 'border-r-4 border-r-gray-400'}`} 
                                                     style={{ 
                                                         right: isLate ? '-1px' : 'auto', 
                                                         left: isLate ? 'auto' : '-1px' 
                                                     }}>
                                                </div>

                                                {/* Label overlay (If >= 60m) */}
                                                {arrowLabel && (
                                                    <div className="bg-white px-1 text-[9px] font-bold text-gray-500 z-10 group-hover:bg-blue-50 transition-colors">
                                                        {isLate ? '+' : '-'}{arrowLabel}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Vertical Drop Lines (only if strictly on a non-zero offset lane) */}
                                            {lane > 0 && (
                                                <div className="absolute w-[1px] border-l border-dashed border-gray-400"
                                                     style={{ 
                                                         left: `${item.pLeft}px`, 
                                                         top: isLate ? `calc(50% + ${yOffsetPx}px)` : '50%',
                                                         height: `${Math.abs(yOffsetPx)}px` 
                                                     }}></div>
                                            )}

                                            {/* Finally, the Actual Event Icon - Rides the connector height precisely */}
                                            <div className="absolute -translate-x-1/2 -translate-y-1/2 z-10" 
                                                 style={{ 
                                                     left: `${item.aLeft}px`, 
                                                     top: `calc(50% + ${yOffsetPx}px)`
                                                 }}>
                                                 <div onClick={openModal} className="pointer-events-auto cursor-pointer">
                                                     {getIconInst(item.terminalEv, false)}
                                                 </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                }
                                
                                return null;
                             })}
                         </div>
                     )}
                 </div>
                 </div>
             </td>
         </tr>
     );
 };

  // --- Render Cell Helper ---
  const renderCell = (row: RowConfig, slotIso: string) => {
    if (row.type === 'section_header') return <div className={`w-full h-full ${row.bgColor}`}></div>;

    if (row.type === 'computed') {
      const val = calculateCumul(row.computeSource!, slotIso);
      return <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-600">{val !== 0 ? val : '-'}</div>;
    }

    if (row.type === 'computed_vertical' && row.id === 'bilan_horaire') {
      const val = calculateBilanHoraire(slotIso);
      const color = val > 0 ? 'text-blue-600' : (val < 0 ? 'text-red-600' : 'text-gray-400');
      return <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${color}`}>{val !== 0 ? (val > 0 ? ` + ${val} ` : val) : '0'}</div>;
    }

    const val = currentDayData[row.id]?.[slotIso];

    if (row.type === 'checkbox') {
      return (
        <div className="flex items-center justify-center w-full h-full cursor-pointer transition-colors hover:bg-emerald-50/30" onClick={() => {
            const nextValue = !(val as boolean);
            handleCommit(row.id, slotIso, nextValue); // Instant commit
            // The background fetch will sync this to the global grid. For immediate visual feedback on checkboxes without re-rendering the whole grid, 
            // a local state wrapper like GridCell would be needed, or we accept the slight visual delay until the next fetch.
            // For now, to stop the lag, we just commit. (The legacy setAllData was dragging performance down)
        }}>
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
          onChange={(e) => {
            const nextValue = e.target.value;
            handleCommit(row.id, slotIso, nextValue); // Instant commit
            // Background fetch will sync this.
          }}
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

    // Color calculation is now handled strictly internally by the GridCell component on blur

    return (
      <GridCell
        initialValue={val as string || ''}
        isNumberType={isNumberType}
        isVomis={isVomis}
        config={row}
        isCurrentHour={slotIso === currentHourLabel}
        onCommit={(newVal) => {
           // We intentionally do NOT call handleLocalChange here.
           // GridCell already holds 'localVal' optimistically.
           // Calling handleLocalChange triggers setAllData which re-renders all 72xN cells causing lag.
           // The background fetchWindowData (every 30s) will eventually resync the global state natively.
           handleCommit(row.id, slotIso, newVal);
        }}
      />
    );
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-white shadow-sm overflow-hidden relative">
       <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer-sweep {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer-sweep {
          animation: shimmer-sweep 2.5s infinite linear;
          background-image: linear-gradient(90deg, #7c3aed 0%, #a78bfa 20%, #7c3aed 40%, #7c3aed 100%);
          background-size: 200% 100%;
        }
       `}} />
      {/* View Toggle / Timeline controls */}
      <div className="flex-none flex flex-col sm:flex-row items-center justify-between p-3 border-b border-gray-200 bg-gray-50 gap-4 shadow-sm z-30 rounded-t-lg">
        {/* Flowsheet Tabs */}
        <div className="flex overflow-x-auto space-x-2 hide-scrollbar max-w-[50%]">
            {flowsheets.map(fs => (
                <button 
                  key={fs.id}
                  onClick={() => setActiveFlowsheetId(fs.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${activeFlowsheetId === fs.id ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                >
                    {fs.label || fs.name}
                </button>
            ))}
        </div>

        <div className="flex items-center space-x-4">
            <div className="flex z-10 p-2 gap-4 items-center">
                {/* Global Active Only Toggle */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">Actifs Uniquement</span>
                    <button 
                        onClick={() => setActiveOnly(!activeOnly)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out flex items-center shadow-inner ${activeOnly ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${activeOnly ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>
                <button
                  onClick={() => setShowChart(true)}
                  className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 shadow-sm transition-colors"
                >
                  <LineChart size={14} className="mr-2" /> Voir Courbes
                </button>
            </div>

            {/* Date Nav */}
            <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm p-0.5">
              <button onClick={() => setSelectedDate(d => new Date(d.setDate(d.getDate() - 1)))} className="p-1 hover:bg-gray-100 text-gray-600"><ChevronLeft size={20} /></button>
              <div className="flex items-center mx-2 px-2 py-1 bg-gray-50 border-x border-gray-100">
                <CalendarIcon size={16} className="text-gray-500 mr-2" />
                <span className="font-bold text-gray-800 text-sm">{selectedDate.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
              </div>
              <button onClick={() => setSelectedDate(d => new Date(d.setDate(d.getDate() + 1)))} className="p-1 hover:bg-gray-100 text-gray-600"><ChevronRight size={20} /></button>
            </div>
        </div>
      </div>

      {/* --- Grid --- */}
      <div ref={scrollContainerRef} className="flex-1 w-full overflow-auto scroll-smooth hide-scrollbar relative">
        <table className="border-separate border-spacing-0 table-fixed" style={{ width: `${300 + timeSlots.length * 80}px` }}>
          {/* Header */}
          <thead className="shadow-md relative z-50">
            <tr className="bg-slate-800 text-white">
              {/* Restored Left Column Header */}
              <th className="p-2 text-left w-[300px] min-w-[300px] max-w-[300px] sticky left-0 top-0 z-50 bg-slate-900 border-r border-slate-700 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.5)]">
              </th>
              {timeSlots.map((slot) => {
                let bgClass = slot.iso === currentHourLabel ? 'bg-emerald-600' : 'bg-slate-800';
                if (slot.isMidnight) bgClass = 'bg-slate-700';
                if (slot.isStartOfDay && slot.iso !== currentHourLabel) bgClass = 'bg-slate-600';

                return (
                    <th key={slot.iso} id={`col-${slot.iso.replace(/[:.]/g, '-')}`} className={`w-[80px] min-w-[80px] max-w-[80px] text-center text-xs font-mono py-2.5 border-r border-b border-slate-700 sticky top-0 z-40 ${bgClass} shadow-[0_1px_0_0_#334155]`}>
                        {slot.label}
                        {slot.isMidnight && <div className="text-[9px] text-gray-400 mt-1 uppercase font-sans">Minuit</div>}
                    </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sections.map(section => (
              <React.Fragment key={section.id}>
                {/* Section Header Row */}
                <tr className="bg-slate-200">
                  {/* Sticky Title Overlay (Left column ONLY) */}
                  <td className="p-0 border-b border-gray-400 bg-slate-200 sticky left-0 z-30">
                    <div className="flex items-center justify-between px-2 py-1.5 w-[300px] min-w-[300px] bg-slate-200 border-r border-gray-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <button
                        onClick={() => setOpenSections(p => ({ ...p, [section.id]: !p[section.id] }))}
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
                            <PlusCircle size={10} className="mr-1" /> Drain
                          </button>
                          <button onClick={() => setRedonCount(c => c + 1)} className="text-[10px] flex items-center bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200 hover:bg-orange-200 whitespace-nowrap">
                            <PlusCircle size={10} className="mr-1" /> Redon
                          </button>
                        </div>
                      )}

                      {section.id === 'divers' && openSections[section.id] && (
                        <div className="flex space-x-2 ml-2">
                          <button onClick={handleAddDiversRow} className="text-[10px] flex items-center bg-gray-200 text-gray-800 px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-300 whitespace-nowrap">
                            <PlusCircle size={10} className="mr-1" /> Ajouter
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Empty Background Overlay (Grid columns) */}
                  <td colSpan={timeSlots.length} className="bg-slate-200 border-b border-gray-400"></td>
                </tr>

                {/* Data Rows */}
                {openSections[section.id] && section.rows.map(row => {
                  if (row.isSubheader) {
                    return (
                        <tr key={row.id} className="bg-slate-100 group">
                            <td className="p-0 border-b border-gray-300 sticky left-0 z-30">
                                <div className="flex items-center px-4 py-1.5 w-[300px] min-w-[300px] bg-slate-100 border-r border-gray-300 text-[11px] font-bold text-slate-500 tracking-wider uppercase">
                                    {row.label}
                                </div>
                            </td>
                            <td colSpan={timeSlots.length} className="bg-slate-100 border-b border-gray-300"></td>
                        </tr>
                    );
                  }

                  return (
                    <React.Fragment key={row.id}>
                      {/* THE TIMELINE ROW (Single row layout) */}
                      {row.type === 'prescription_timeline' ? renderPrescriptionTimelineRow(row) : (
                          <tr className={`group transition-colors ${row.bgColor || 'bg-white'}`}>
                            {/* Left column holding all metadata */}
                            <td className={`align-top p-0 sticky left-0 z-30 border-r border-b border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors ${row.bgColor || 'bg-white'} ${row.hoverBg !== undefined ? row.hoverBg : 'group-hover:bg-blue-50'} ${row.textColor || ''} w-[300px] min-w-[300px] max-w-[300px] ${row.epicHeader ? 'h-[72px]' : 'h-10'}`}>
                                 {row.epicHeader ? row.epicHeader : (
                                    <div className="flex w-full items-center justify-between px-2 overflow-hidden h-full font-bold text-gray-700 text-[11px] py-1">
                                       <span className="truncate" title={row.label as string}>{row.label}</span>
                                       {row.unit && <span className="text-[9px] text-gray-400 font-normal ml-2 shrink-0">{row.unit}</span>}
                                    </div>
                                 )}
                            </td>
                            {timeSlots.map((slot, index) => {
                              const isExtraBorder = slot.isMidnight || slot.isStartOfDay;
                              return (
                                  <td
                                    key={`${row.id}-${slot.iso}`}
                                    className={`
                                        w-[80px] min-w-[80px] max-w-[80px] border-r border-b border-gray-200 p-0 relative transition-colors ${row.epicHeader ? 'h-[72px]' : 'h-10'}
                                        ${slot.iso === currentHourLabel ? 'bg-emerald-50/40 ring-1 ring-inset ring-emerald-100' : ''}
                                        ${isExtraBorder ? 'border-r-2 border-r-gray-400' : ''}
                                        ${row.textColor || ''}
                                        ${row.hoverBg !== undefined ? row.hoverBg : 'group-hover:bg-blue-50'}
                                    `}
                                  >
                                    {renderCell(row, slot.iso)}
                                  </td>
                              )
                            })}
                          </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
              <VitalSignsChart data={currentDayData} hours={timeSlots.map(t => t.iso)} />
              <p className="text-center text-sm text-gray-500 mt-4">
                Les données affichées correspondent à la plage de surveillance de 72h.
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

      {/* Stop Confirmation Modal */}
      {stopModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] backdrop-blur-sm" onClick={() => setStopModal({ isOpen: false, prescriptionId: '' })}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-[450px] relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <button 
                   onClick={() => setStopModal({ isOpen: false, prescriptionId: '' })}
                   className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <AlertTriangle size={28} />
                    <h3 className="text-xl font-bold">Confirmer l'arrêt</h3>
                </div>
                <p className="text-slate-600 mb-6 text-sm">
                    Vous êtes sur le point d'arrêter définitivement cette prescription. Cette action rayera la ligne et bloquera toute nouvelle administration.
                </p>
                <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const reason = formData.get('reason') as string;
                        handleStopPrescription(stopModal.prescriptionId, reason);
                    }}
                    className="flex flex-col gap-4"
                >
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Raison de l'arrêt (Optionnel)</label>
                        <input 
                            name="reason"
                            type="text" 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                            placeholder="Ex: Fin de traitement, Intolérance..."
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-2">
                        <button
                            type="button"
                            onClick={() => setStopModal({ isOpen: false, prescriptionId: '' })}
                            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
                        >
                            Confirmer l'arrêt
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- Administration Modal Portal --- */}
      <AdminModalPortal
        onSave={handleSaveAdministration}
        onCancelEvent={handleCancelAdminEvent}
        onSkipEvent={handleSkipPrescriptionEvent}
        availableBags={[]}
      />
      
    </div>
  );
};

export const FicheSurveillanceTab: React.FC<any> = (props) => (
  <AdminModalProvider>
      <FicheSurveillance {...props} />
  </AdminModalProvider>
);