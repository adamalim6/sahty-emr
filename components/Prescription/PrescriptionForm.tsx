import React, { useState, useCallback, useMemo } from 'react';
import {
  Pill,
  Calendar,
  CheckCircle,
  Activity,
  ChevronDown,
  Clock,
  FlaskConical,
  Syringe,
  Search,
  AlertCircle,
  X,
  Timer,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Zap,
  Sun,
  Sunset,
  Moon
} from 'lucide-react';
import { MOLECULE_DB_UNIVERSAL, MOLECULE_DB_HOSPITAL, UNITS, ROUTES } from './constants';
import { FormData, ScheduleData, SolventData, MoleculeDatabase, PrescriptionType } from './types';
import { durationToDecimal, formatDuration, getPosologyText, FULL_DAYS_MAP } from './utils';
import { PrescriptionCard } from './PrescriptionCard';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];


const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const STANDARD_TIMES = [
  { label: 'Matin', time: '08:00', icon: Sun },
  { label: 'Midi', time: '12:00', icon: Sunset },
  { label: 'Soir', time: '20:00', icon: Moon },
];

const HOURS_24 = Array.from({ length: 24 }).map((_, i) => `${String(i).padStart(2, '0')}:${String(0).padStart(2, '0')}`);

// Generate 30-minute intervals for the time picker dropdown
const TIME_SLOTS = Array.from({ length: 48 }).map((_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

const OVERLAP_ERROR_MSG = "Intervalle de durée entre la 1ère et la 2ème prise programmée < Durée d’administration du médicament. Ajustez la durée d’administration et / ou la date & heure de début choisies.";
const SPECIFIC_ADMIN_INTERVAL_ERROR = "Durée inter-prise doit être supérieure à la durée d'administration du médicament.";
const CYCLIC_ADMIN_INTERVAL_ERROR = "Le cycle de répétition ne peut pas être inférieur à la durée totale d'administration.";

const getCurrentDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Returns current datetime string for HTML input min attribute (YYYY-MM-DDTHH:mm)
const getMinDateTimeForInput = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes());
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};





interface PrescriptionFormProps {
  onSave?: (data: FormData) => void;
}

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({ onSave }) => {
  // --- STATE ---
  const [formData, setFormData] = useState<FormData>({
    molecule: "",
    commercialName: "",
    qty: "--",
    unit: "mg",
    route: "Orale",
    adminMode: "instant",
    adminDuration: "",
    type: "frequency",
    dilutionRequired: false,
    substitutable: true,
    solvent: {
      molecule: "",
      commercialName: "",
      qty: "--",
      unit: "mL",
    },
    databaseMode: 'hospital',
    schedule: {
      dailySchedule: "everyday",
      mode: "cycle",
      interval: "",
      isCustomInterval: false,
      startDateTime: getCurrentDateTime(),
      durationValue: "--",
      durationUnit: "days",
      selectedDays: [],
      specificTimes: [],
      simpleCount: "1",
      simplePeriod: "day",
      intervalDuration: "",
    },
    conditionComment: "",
  });

  const [filteredCommercialNames, setFilteredCommercialNames] = useState<string[]>([]);
  const [showCommercialSuggestions, setShowCommercialSuggestions] = useState(false);
  const [filteredMoleculeNames, setFilteredMoleculeNames] = useState<string[]>([]);
  const [showMoleculeSuggestions, setShowMoleculeSuggestions] = useState(false);

  // Solvent-specific autocomplete states
  const [solventFilteredMoleculeNames, setSolventFilteredMoleculeNames] = useState<string[]>([]);
  const [showSolventMoleculeSuggestions, setShowSolventMoleculeSuggestions] = useState(false);
  const [solventFilteredCommercialNames, setSolventFilteredCommercialNames] = useState<string[]>([]);
  const [showSolventCommercialSuggestions, setShowSolventCommercialSuggestions] = useState(false);

  // State for manually skipped doses
  const [skippedDoseIds, setSkippedDoseIds] = useState<Set<string>>(new Set());

  const [summary, setSummary] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // --- CALENDAR MODAL STATE ---
  const [showCalendar, setShowCalendar] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date()); // The month being viewed
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null); // The selected day
  const [tempTime, setTempTime] = useState(""); // Default empty to force user selection

  // --- MEMOIZED DATA ---
  const activeMoleculeDB: MoleculeDatabase = useMemo(() => {
    return formData.databaseMode === 'hospital' ? MOLECULE_DB_HOSPITAL : MOLECULE_DB_UNIVERSAL;
  }, [formData.databaseMode]);

  const allAvailableCommercialNames = useMemo(() => {
    const names = new Set<string>();
    for (const moleculeKey in activeMoleculeDB) {
      activeMoleculeDB[moleculeKey].forEach(brand => names.add(brand));
    }
    return Array.from(names).sort();
  }, [activeMoleculeDB]);

  const allAvailableSolventCommercialNames = useMemo(() => {
    const names = new Set<string>();
    const solventMolecules = Object.keys(activeMoleculeDB).filter(m => ["Glucose", "Chlorure de sodium", "Eau pour préparation injectable"].some(s => m.includes(s)));
    for (const moleculeKey of solventMolecules) {
      activeMoleculeDB[moleculeKey].forEach(brand => names.add(brand));
    }
    return Array.from(names).sort();
  }, [activeMoleculeDB]);


  // --- HANDLERS ---

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (isSubmitted) setIsSubmitted(false);
  };

  const handleTypeChange = (newType: PrescriptionType) => {
    setFormData(prev => {
      let newSchedule = { ...prev.schedule };

      if (newType === 'punctual-frequency') {
        newSchedule.startDateTime = "";
      } else if (newType === 'frequency' && (!prev.schedule.startDateTime || prev.type === 'punctual-frequency')) {
        if (!prev.schedule.startDateTime) {
          newSchedule.startDateTime = getCurrentDateTime();
        }
      } else if (newType === 'one-time') {
        if (!prev.schedule.startDateTime) {
          newSchedule.startDateTime = getCurrentDateTime();
        }
      }

      return { ...prev, type: newType, schedule: newSchedule };
    });
    if (isSubmitted) setIsSubmitted(false);
  };

  const updateSchedule = (field: keyof ScheduleData, value: any) => {
    setFormData(prev => {
      const newSchedule = { ...prev.schedule, [field]: value };

      // RESET RULE: When switching to 'specific-time' mode while in 'punctual-frequency', 
      // reset start time to ensure user picks a valid specific time.
      if (field === 'mode' && value === 'specific-time' && prev.type === 'punctual-frequency') {
        newSchedule.startDateTime = "";
      }

      return { ...prev, schedule: newSchedule };
    });
    if (isSubmitted) setIsSubmitted(false);
  };

  const updateSolventField = (field: keyof SolventData, value: any) => {
    setFormData(prev => ({
      ...prev,
      solvent: { ...prev.solvent!, [field]: value }
    }));
    if (isSubmitted) setIsSubmitted(false);
  };

  const getMoleculeOfCommercialName = useCallback((commercialName: string, db: MoleculeDatabase = activeMoleculeDB): string | null => {
    for (const molKey in db) {
      if (db[molKey].includes(commercialName)) {
        return molKey;
      }
    }
    return null;
  }, [activeMoleculeDB]);

  // --- Database Mode Change Handler ---
  const handleDatabaseModeChange = (mode: 'hospital' | 'universal') => {
    setFormData(prev => ({
      ...prev,
      databaseMode: mode,
      molecule: "",
      commercialName: "",
      solvent: {
        molecule: "",
        commercialName: "",
        qty: "--",
        unit: "mL",
      },
    }));
    setFilteredMoleculeNames([]);
    setShowMoleculeSuggestions(false);
    setFilteredCommercialNames([]);
    setShowCommercialSuggestions(false);
    setSolventFilteredMoleculeNames([]);
    setShowSolventMoleculeSuggestions(false);
    setSolventFilteredCommercialNames([]);
    setShowSolventCommercialSuggestions(false);
    if (isSubmitted) setIsSubmitted(false);
  };

  // --- Main Drug Handlers ---
  const handleMoleculeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => {
      const matchingMolecules = Object.keys(activeMoleculeDB).filter(k =>
        k.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredMoleculeNames(matchingMolecules);
      setShowMoleculeSuggestions(val.length > 0 && matchingMolecules.length > 0);

      let newCommercialName = prev.commercialName;
      if (newCommercialName && val.length > 0) {
        const brandsForTypedMolecule = activeMoleculeDB[val] || [];
        if (!brandsForTypedMolecule.includes(newCommercialName)) {
          newCommercialName = "";
        }
      } else if (val.length === 0) {
        newCommercialName = "";
      }

      return { ...prev, molecule: val, commercialName: newCommercialName };
    });
    if (isSubmitted) setIsSubmitted(false);
  };

  const handleMoleculeSuggestionClick = (selectedMolecule: string) => {
    setFormData(prev => {
      let newCommercialName = prev.commercialName;
      const brandsForNewMolecule = activeMoleculeDB[selectedMolecule] || [];
      if (newCommercialName && !brandsForNewMolecule.includes(newCommercialName)) {
        newCommercialName = "";
      }
      return { ...prev, molecule: selectedMolecule, commercialName: newCommercialName };
    });
    setShowMoleculeSuggestions(false);
    setFilteredMoleculeNames([]);
    if (isSubmitted) setIsSubmitted(false);
  };

  const handleCommercialNameFocus = useCallback(() => {
    let suggestions: string[] = [];
    if (formData.molecule && activeMoleculeDB[formData.molecule]) {
      suggestions = activeMoleculeDB[formData.molecule];
    } else {
      suggestions = allAvailableCommercialNames;
    }
    setFilteredCommercialNames(suggestions.filter(b =>
      b.toLowerCase().includes(formData.commercialName.toLowerCase())
    ));
    setShowCommercialSuggestions(true);
  }, [formData.molecule, formData.commercialName, activeMoleculeDB, allAvailableCommercialNames]);


  const handleCommercialNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => {
      let newMolecule = prev.molecule;
      let suggestions: string[] = [];

      if (prev.molecule && activeMoleculeDB[prev.molecule]) {
        suggestions = activeMoleculeDB[prev.molecule].filter(b => b.toLowerCase().includes(val.toLowerCase()));
      } else {
        suggestions = allAvailableCommercialNames.filter(b => b.toLowerCase().includes(val.toLowerCase()));
      }
      setFilteredCommercialNames(suggestions);
      setShowCommercialSuggestions(val.length > 0 || suggestions.length > 0);

      if (suggestions.length === 1 && suggestions[0].toLowerCase() === val.toLowerCase()) {
        const deducedMolecule = getMoleculeOfCommercialName(suggestions[0]);
        if (deducedMolecule && newMolecule.toLowerCase() !== deducedMolecule.toLowerCase()) {
          newMolecule = deducedMolecule;
        }
      } else if (val.length === 0) {
        if (prev.molecule && getMoleculeOfCommercialName(prev.commercialName || '', activeMoleculeDB) === prev.molecule) {
          newMolecule = "";
        }
      }

      return { ...prev, commercialName: val, molecule: newMolecule };
    });
    if (isSubmitted) setIsSubmitted(false);
  };

  const handleCommercialSuggestionClick = (selectedBrand: string) => {
    setFormData(prev => {
      const deducedMolecule = getMoleculeOfCommercialName(selectedBrand);
      const newMolecule = (deducedMolecule && prev.molecule.toLowerCase() !== deducedMolecule.toLowerCase()) ? deducedMolecule : prev.molecule;
      return { ...prev, commercialName: selectedBrand, molecule: newMolecule };
    });
    setShowCommercialSuggestions(false);
    setFilteredCommercialNames([]);
    setShowMoleculeSuggestions(false);
    setFilteredMoleculeNames([]);
    if (isSubmitted) setIsSubmitted(false);
  };

  // --- Solvent Drug Handlers ---
  const handleSolventMoleculeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => {
      const matchingMolecules = Object.keys(activeMoleculeDB).filter(k =>
        k.toLowerCase().includes(val.toLowerCase()) &&
        ["Glucose", "Chlorure de sodium", "Eau pour préparation injectable"].some(s => k.includes(s))
      );
      setSolventFilteredMoleculeNames(matchingMolecules);
      setShowSolventMoleculeSuggestions(val.length > 0 && matchingMolecules.length > 0);

      let newCommercialName = prev.solvent?.commercialName || "";
      if (newCommercialName && val.length > 0) {
        const brandsForTypedMolecule = activeMoleculeDB[val] || [];
        if (!brandsForTypedMolecule.includes(newCommercialName)) {
          newCommercialName = "";
        }
      } else if (val.length === 0) {
        newCommercialName = "";
      }

      return {
        ...prev,
        solvent: { ...prev.solvent!, molecule: val, commercialName: newCommercialName }
      };
    });
    if (isSubmitted) setIsSubmitted(false);
  };

  const handleSolventMoleculeSuggestionClick = (selectedMolecule: string) => {
    setFormData(prev => {
      let newCommercialName = prev.solvent?.commercialName || "";
      const brandsForNewMolecule = activeMoleculeDB[selectedMolecule] || [];
      if (newCommercialName && !brandsForNewMolecule.includes(newCommercialName)) {
        newCommercialName = "";
      }
      return { ...prev, solvent: { ...prev.solvent!, molecule: selectedMolecule, commercialName: newCommercialName } };
    });
    setShowSolventMoleculeSuggestions(false);
    setSolventFilteredMoleculeNames([]);
    if (isSubmitted) setIsSubmitted(false);
  };

  const handleSolventCommercialNameFocus = useCallback(() => {
    let suggestions: string[] = [];
    if (formData.solvent?.molecule && activeMoleculeDB[formData.solvent.molecule]) {
      suggestions = activeMoleculeDB[formData.solvent.molecule];
    } else {
      suggestions = allAvailableSolventCommercialNames;
    }
    setSolventFilteredCommercialNames(suggestions.filter(b =>
      b.toLowerCase().includes(formData.solvent?.commercialName?.toLowerCase() || '')
    ));
    setShowSolventCommercialSuggestions(true);
  }, [formData.solvent?.molecule, formData.solvent?.commercialName, activeMoleculeDB, allAvailableSolventCommercialNames]);

  const handleSolventCommercialNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => {
      let newMolecule = prev.solvent?.molecule || "";
      let suggestions: string[] = [];

      if (prev.solvent?.molecule && activeMoleculeDB[prev.solvent.molecule]) {
        suggestions = activeMoleculeDB[prev.solvent.molecule].filter(b => b.toLowerCase().includes(val.toLowerCase()));
      } else {
        suggestions = allAvailableSolventCommercialNames.filter(b => b.toLowerCase().includes(val.toLowerCase()));
      }
      setSolventFilteredCommercialNames(suggestions);
      setShowSolventCommercialSuggestions(val.length > 0 || suggestions.length > 0);

      if (suggestions.length === 1 && suggestions[0].toLowerCase() === val.toLowerCase()) {
        const deducedMolecule = getMoleculeOfCommercialName(suggestions[0]);
        if (deducedMolecule && newMolecule.toLowerCase() !== deducedMolecule.toLowerCase()) {
          newMolecule = deducedMolecule;
        }
      } else if (val.length === 0) {
        if (prev.solvent?.molecule && getMoleculeOfCommercialName(prev.solvent.commercialName || '', activeMoleculeDB) === prev.solvent.molecule) {
          newMolecule = "";
        }
      }

      return { ...prev, solvent: { ...prev.solvent!, commercialName: val, molecule: newMolecule } };
    });
    if (isSubmitted) setIsSubmitted(false);
  };

  const handleSolventCommercialSuggestionClick = (selectedBrand: string) => {
    setFormData(prev => {
      const deducedMolecule = getMoleculeOfCommercialName(selectedBrand);
      const newMolecule = (deducedMolecule && prev.solvent?.molecule?.toLowerCase() !== deducedMolecule.toLowerCase()) ? deducedMolecule : (prev.solvent?.molecule || "");
      return { ...prev, solvent: { ...prev.solvent!, commercialName: selectedBrand, molecule: newMolecule } };
    });
    setShowSolventCommercialSuggestions(false);
    setSolventFilteredCommercialNames([]);
    setShowSolventMoleculeSuggestions(false);
    setSolventFilteredMoleculeNames([]);
    if (isSubmitted) setIsSubmitted(false);
  };

  // --- DOSAGE & DURATION PICKER LOGIC ---

  const parseDuration = (d: string) => {
    if (!d) return { h: 0, m: 0 };
    const [h, m] = d.split(':').map(Number);
    return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
  };

  const handleManualTimeChange = (
    type: 'hours' | 'minutes',
    val: string,
    fieldPath: 'adminDuration' | 'schedule.intervalDuration'
  ) => {
    let currentDurationString: string;
    if (fieldPath === 'adminDuration') {
      currentDurationString = formData.adminDuration || '00:00';
    } else {
      currentDurationString = formData.schedule.intervalDuration || '00:00';
    }

    let { h, m } = parseDuration(currentDurationString);
    const num = val === '' ? 0 : parseInt(val);

    if (type === 'hours') {
      h = isNaN(num) ? 0 : Math.max(0, num);
    } else {
      m = isNaN(num) ? 0 : Math.max(0, Math.min(59, num));
    }
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const newDuration = `${hh}:${mm}`;

    if (fieldPath === 'adminDuration') {
      updateField('adminDuration', newDuration);
    } else {
      updateSchedule('intervalDuration', newDuration);
    }
  };


  // --- CALENDAR MODAL LOGIC ---

  const openCalendarModal = () => {
    const currentStr = formData.schedule.startDateTime;
    let initialDate = new Date();

    if (currentStr) {
      const d = new Date(currentStr);
      if (!isNaN(d.getTime())) {
        initialDate = d;
      }
    }

    setPickerDate(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
    setTempSelectedDate(initialDate);
    // FORCE EMPTY TIME on open to prevent auto-selection of past/incorrect time
    setTempTime("");
    setShowCalendar(true);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    // 0 = Sunday, 1 = Monday, etc.
    const day = new Date(year, month, 1).getDay();
    return (day === 0 ? 6 : day - 1);
  };

  const handlePrevMonth = () => {
    setPickerDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setPickerDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    if (isDateDisabled(day)) return;

    const newDate = new Date(pickerDate.getFullYear(), pickerDate.getMonth(), day);
    setTempSelectedDate(newDate);
  };

  const confirmDateTime = () => {
    if (tempSelectedDate && tempTime) {
      const yyyy = tempSelectedDate.getFullYear();
      const mm = String(tempSelectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(tempSelectedDate.getDate()).padStart(2, '0');

      const dateTimeStr = `${yyyy}-${mm}-${dd}T${tempTime}`;
      updateSchedule('startDateTime', dateTimeStr);
      setShowCalendar(false);
    }
  };

  // --- UI BLOCKING HELPER FUNCTIONS ---

  const isDateDisabled = (day: number) => {
    const targetDate = new Date(pickerDate.getFullYear(), pickerDate.getMonth(), day);
    targetDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return targetDate < today;
  };

  const isTimeDisabled = (time: string) => {
    if (!tempSelectedDate) return false;

    // Strict validation for "Ponct + Freq" & "Specific Time"
    if (formData.type === 'punctual-frequency' && formData.schedule.mode === 'specific-time' && formData.schedule.specificTimes.length > 0) {
      if (!formData.schedule.specificTimes.includes(time)) {
        return true;
      }
    }

    const selectedDateNormalized = new Date(tempSelectedDate);
    selectedDateNormalized.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDateNormalized.getTime() !== today.getTime()) return false;

    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();

    if (h < currentH) return true;
    if (h === currentH && m <= currentM) return true;

    return false;
  };


  // --- Daily Schedule Handlers ---
  const handleDailyScheduleChange = (value: 'everyday' | 'every-other-day' | 'specific-days') => {
    setFormData(prev => {
      let newScheduleMode = prev.schedule.mode;
      if ((value === 'every-other-day' || value === 'specific-days') && prev.schedule.mode === 'cycle') {
        newScheduleMode = 'simple';
      }
      return {
        ...prev,
        schedule: {
          ...prev.schedule,
          dailySchedule: value,
          mode: newScheduleMode
        }
      };
    });
    if (isSubmitted) setIsSubmitted(false);
  };

  const toggleDay = useCallback((day: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        selectedDays: prev.schedule.selectedDays.includes(day)
          ? prev.schedule.selectedDays.filter(d => d !== day)
          : [...prev.schedule.selectedDays, day]
      }
    }));
    if (isSubmitted) setIsSubmitted(false);
  }, [isSubmitted]);

  // --- Frequency Mode Handlers ---
  const handleIntervalSelect = useCallback((hr: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: { ...prev.schedule, interval: hr, isCustomInterval: false }
    }));
    if (isSubmitted) setIsSubmitted(false);
  }, [isSubmitted]);

  const handleCustomInterval = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        isCustomInterval: true,
        interval: ['2', '4', '6', '8', '12', '24'].includes(prev.schedule.interval) ? '' : prev.schedule.interval
      }
    }));
    if (isSubmitted) setIsSubmitted(false);
  }, [isSubmitted]);

  const toggleSpecificTime = useCallback((time: string) => {
    setFormData(prev => {
      const isRemoving = prev.schedule.specificTimes.includes(time);
      const newTimes = isRemoving
        ? prev.schedule.specificTimes.filter(t => t !== time)
        : [...prev.schedule.specificTimes, time].sort();

      let newStartDateTime = prev.schedule.startDateTime;

      // RESET RULE: If in 'punctual-frequency' mode, ensure start time remains valid
      if (prev.type === 'punctual-frequency' && prev.schedule.mode === 'specific-time') {
        if (newStartDateTime) {
          const currentStartTime = newStartDateTime.split('T')[1];
          // If the selected start time is removed, or is not in the new list (and list is not empty)
          // If list is empty, start time MUST be reset because there are no valid specific times.
          if (!newTimes.includes(currentStartTime)) {
            newStartDateTime = "";
          }
        }
      }

      return {
        ...prev,
        schedule: {
          ...prev.schedule,
          specificTimes: newTimes,
          startDateTime: newStartDateTime
        }
      };
    });
    if (isSubmitted) setIsSubmitted(false);
  }, [isSubmitted]);

  const addCustomTime = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTime = e.target.value;
    if (newTime && !formData.schedule.specificTimes.includes(newTime)) {
      setFormData(prev => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          specificTimes: [...prev.schedule.specificTimes, newTime].sort()
        }
      }));
      if (isSubmitted) setIsSubmitted(false);
    }
    e.target.value = '';
  }, [formData.schedule.specificTimes, isSubmitted]);


  // --- VALIDATION & BUSINESS LOGIC ---

  const getValidationState = () => {
    const { molecule, qty, unit, route, type, schedule, adminMode, adminDuration, dilutionRequired, solvent } = formData;

    const errorMessages: string[] = [];

    // Basic Required Fields
    if (!molecule) errorMessages.push('Molécule (Principe Actif)');
    const parsedQty = parseFloat(qty === '--' ? '0' : qty);
    if (!qty || isNaN(parsedQty) || parsedQty <= 0) errorMessages.push('Dosage (doit être > 0)');
    if (!unit) errorMessages.push('Unité');
    if (!route) errorMessages.push('Voie d\'administration');

    // Date validation
    if (type !== 'punctual-frequency') {
      if (!schedule.startDateTime) errorMessages.push('Date de Début');
    } else {
      if (!schedule.startDateTime) errorMessages.push('Date de Début de la fréquence');
    }

    // Conditional Required Fields
    const durationAdminDecimal = durationToDecimal(adminDuration);
    if (adminMode === 'continuous' && (!adminDuration || durationAdminDecimal <= 0)) {
      errorMessages.push('Durée d\'administration (doit être > 0)');
    }

    const parsedDurationValue = parseFloat(schedule.durationValue === '--' ? '0' : schedule.durationValue);
    if ((type === 'frequency' || type === 'punctual-frequency' || adminMode === 'permanent') && (!schedule.durationValue || isNaN(parsedDurationValue) || parsedDurationValue <= 0)) {
      errorMessages.push('Durée de Traitement (doit être > 0)');
    }

    // Business Rules
    if (adminMode !== 'permanent') {
      if (schedule.dailySchedule === 'every-other-day' && schedule.mode === 'cycle') {
        errorMessages.push('Le mode cyclique n\'est pas compatible avec la fréquence \'1 jour / 2\'');
      }
      if (schedule.dailySchedule === 'specific-days' && schedule.mode === 'cycle') {
        errorMessages.push('Le mode cyclique n\'est pas compatible avec la fréquence \'Jours spécifiques\'');
      }

      const interval = parseFloat(schedule.interval || '0') || 0;
      const isContinuous = adminMode === 'continuous';
      const isCycle = schedule.mode === 'cycle';
      if (isContinuous && isCycle && durationAdminDecimal > 0 && interval > 0 && durationAdminDecimal >= interval) {
        errorMessages.push(CYCLIC_ADMIN_INTERVAL_ERROR);
      }
      if (isCycle && (schedule.interval === "" || parseFloat(schedule.interval) <= 0)) {
        errorMessages.push('Cycle de prise manquant');
      }

      const selectedCount = schedule.selectedDays.length;
      const durationVal = parsedDurationValue;
      const durationInDays = schedule.durationUnit === 'weeks' ? durationVal * 7 : durationVal;
      const daysMode = (type === 'frequency' || type === 'punctual-frequency') && schedule.dailySchedule === 'specific-days';

      if (daysMode) {
        if (selectedCount === 0) {
          errorMessages.push('Sélectionner au moins un jour');
        }
        if (selectedCount > 0 && durationVal > 0 && selectedCount > durationInDays) {
          errorMessages.push('La durée du traitement doit être au moins égale au nombre de jours sélectionnés');
        }
      }

      const timeMode = (type === 'frequency' || type === 'punctual-frequency') && schedule.mode === 'specific-time';
      if (timeMode && (!schedule.specificTimes || !Array.isArray(schedule.specificTimes) || schedule.specificTimes.length === 0)) {
        errorMessages.push('Sélectionner au moins une heure de prise');
      }

      // New Validation: Start time match for Punctual + Freq + Specific Time
      if (type === 'punctual-frequency' && schedule.mode === 'specific-time' && schedule.specificTimes.length > 0 && schedule.startDateTime) {
        const startTimeStr = schedule.startDateTime.split('T')[1];
        if (!schedule.specificTimes.includes(startTimeStr)) {
          errorMessages.push("L'heure de début doit correspondre à une des heures fixes sélectionnées");
        }
      }

      // New Validation: Interval between fixed times (if continuous)
      if (adminMode === 'continuous' && schedule.mode === 'specific-time' && schedule.specificTimes.length > 0) {
        const adminDurationHours = durationToDecimal(adminDuration);
        const sortedTimes = [...schedule.specificTimes].sort();
        for (let i = 0; i < sortedTimes.length; i++) {
          const t1 = durationToDecimal(sortedTimes[i]);
          const t2 = durationToDecimal(sortedTimes[(i + 1) % sortedTimes.length]);
          let diff = t2 - t1;
          if (diff < 0) diff += 24;
          if (diff < adminDurationHours) {
            errorMessages.push("L'intervalle entre certaines heures fixes est inférieur à la durée d'administration");
            break;
          }
        }
      }

      const simpleMode = (type === 'frequency' || type === 'punctual-frequency') && schedule.mode === 'simple';
      const numDoses = parseInt(schedule.simpleCount || '0');
      const intervalDurationDecimal = durationToDecimal(schedule.intervalDuration || '00:00');

      if (simpleMode) {
        if (!schedule.simpleCount || numDoses <= 0) {
          errorMessages.push('Indiquer une fréquence positive pour le mode Simple');
        } else if (numDoses > 1) {
          if (schedule.intervalDuration && intervalDurationDecimal > 0) {
            const startDateObj = schedule.startDateTime ? new Date(schedule.startDateTime) : new Date();
            const startTimeInMinutes = startDateObj.getHours() * 60 + startDateObj.getMinutes();
            const lastDoseTimeInMinutes = startTimeInMinutes + (numDoses - 1) * intervalDurationDecimal * 60;
            if (lastDoseTimeInMinutes >= 24 * 60) {
              errorMessages.push('Les prises calculées dépassent la fin de la journée (Mode Simple). Veuillez ajuster la fréquence ou l\'intervalle.');
            }
          }
        }
      }
    }

    if (adminMode === 'continuous' && schedule.mode === 'simple') {
      const durationAdminDecimal = durationToDecimal(adminDuration);
      const intervalDurationDecimal = durationToDecimal(schedule.intervalDuration || '00:00');

      if (durationAdminDecimal > 0 && intervalDurationDecimal > 0 && durationAdminDecimal >= intervalDurationDecimal) {
        errorMessages.push(SPECIFIC_ADMIN_INTERVAL_ERROR);
      }
    }

    // OVERLAP ERROR CHECK
    if (adminMode === 'continuous' && type === 'punctual-frequency') {
      const adminDurationHours = durationToDecimal(adminDuration);

      if (schedule.startDateTime && adminDurationHours > 0) {
        const now = new Date();
        const firstScheduledDate = new Date(schedule.startDateTime);

        const diffInMs = firstScheduledDate.getTime() - now.getTime();
        const diffInHours = diffInMs / (1000 * 60 * 60);

        if (diffInHours < adminDurationHours) {
          errorMessages.push(OVERLAP_ERROR_MSG);
        }
      }
    }

    if (dilutionRequired && solvent) {
      if (!solvent.molecule) errorMessages.push('Molécule du solvant');
      const parsedSolventQty = parseFloat(solvent.qty === '--' ? '0' : solvent.qty);
      if (!solvent.qty || isNaN(parsedSolventQty) || parsedSolventQty <= 0) errorMessages.push('Dosage du solvant (doit être > 0)');
      if (!solvent.unit) errorMessages.push('Unité du solvant');
    }

    const isValid = errorMessages.length === 0;

    return {
      alerte: {
        active: !isValid,
        message: isValid ? "" : `Manquant / Incohérence : ${errorMessages.join(', ')}.`
      },
      validation_autorisee: isValid
    };
  };

  const validationState = getValidationState();

  const showInterDoseWarning = useMemo(() => {
    return (
      formData.schedule.mode === 'simple' &&
      (formData.type === 'frequency' || formData.type === 'punctual-frequency') &&
      parseInt(formData.schedule.simpleCount || '0') > 1 &&
      (!formData.schedule.intervalDuration || durationToDecimal(formData.schedule.intervalDuration) <= 0)
    );
  }, [formData.schedule, formData.type]);

  // --- POSOLOGY GENERATION ---


  const posologyText = getPosologyText(formData);

  // --- DOSE SCHEDULE CARDS LOGIC ---
  const getDoseScheduleCards = useMemo(() => {
    const { schedule, type, adminMode } = formData;
    const { startDateTime, durationValue, durationUnit, dailySchedule, selectedDays, mode, interval, specificTimes, simpleCount, intervalDuration } = schedule;

    if (!startDateTime || durationValue === '--' || parseFloat(durationValue) <= 0) {
      return { needsDetail: false, message: "Veuillez compléter la date de début et la durée de traitement pour voir le détail des prises.", cards: [], allDosesMap: new Map(), isError: false };
    }

    const startDate = new Date(startDateTime);
    if (isNaN(startDate.getTime())) {
      return { needsDetail: false, message: "Date de début invalide.", cards: [], allDosesMap: new Map(), isError: false };
    }

    if (type === 'one-time') {
      const oneTimeDose = {
        id: startDate.toISOString(),
        date: startDate,
        time: startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      };
      const singleDoseMap = new Map().set(oneTimeDose.id, oneTimeDose);
      return { needsDetail: true, message: null, cards: [oneTimeDose], allDosesMap: singleDoseMap, isError: false };
    }

    if (adminMode === 'permanent') {
      return { needsDetail: false, message: "Le détail des prises n'est pas applicable pour l'administration en continu.", cards: [], allDosesMap: new Map(), isError: false };
    }

    if (mode === 'simple') {
      const numDoses = parseInt(simpleCount || '0');
      const intervalDurationDecimal = durationToDecimal(intervalDuration || '00:00');

      if (numDoses > 1 && intervalDurationDecimal <= 0) {
        return {
          needsDetail: true,
          message: "Veuillez remplir la durée inter-prise pour générer le détail des prises",
          cards: [],
          allDosesMap: new Map(),
          isError: true,
        };
      }

      if (numDoses > 1 && intervalDurationDecimal > 0) {
        const startTimeInMinutes = startDate.getHours() * 60 + startDate.getMinutes();
        const intervalInMinutes = intervalDurationDecimal * 60;
        const lastDoseTimeInMinutes = startTimeInMinutes + (numDoses - 1) * intervalInMinutes;

        if (lastDoseTimeInMinutes >= 24 * 60) {
          return {
            needsDetail: true,
            message: "⚠️ Les prises calculées dépassent la fin de la journée. Veuillez ajuster la durée inter-prise ou l’heure de début.",
            cards: [],
            allDosesMap: new Map(),
            isError: true,
          };
        }
      }
    }

    const totalDuration = parseFloat(durationValue);
    const endDate = new Date(startDate);
    if (durationUnit === 'days') {
      endDate.setDate(startDate.getDate() + totalDuration - 1);
    } else if (durationUnit === 'weeks') {
      endDate.setDate(startDate.getDate() + (totalDuration * 7) - 1);
    }
    endDate.setHours(23, 59, 59, 999);

    const allCalculatedDoses: Date[] = [];

    if (type === 'punctual-frequency') {
      allCalculatedDoses.push(new Date());
    }

    if (mode === 'cycle') {
      const intervalHours = parseFloat(interval || '0');
      if (intervalHours > 0) {
        let currentDoseTime = new Date(startDate);
        const intervalMs = intervalHours * 60 * 60 * 1000;

        while (currentDoseTime.getTime() <= endDate.getTime()) {
          allCalculatedDoses.push(new Date(currentDoseTime));
          currentDoseTime = new Date(currentDoseTime.getTime() + intervalMs);
        }
      }
    }
    else {
      let dayIterator = new Date(startDate);
      dayIterator.setHours(0, 0, 0, 0);

      while (dayIterator.getTime() <= endDate.getTime()) {
        let isDayEligible = false;
        const dayOfWeekShort = DAYS[dayIterator.getDay() === 0 ? 6 : dayIterator.getDay() - 1];

        if (dailySchedule === 'everyday') {
          isDayEligible = true;
        } else if (dailySchedule === 'every-other-day') {
          const startDayOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const diffTime = dayIterator.getTime() - startDayOnly.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          isDayEligible = (diffDays % 2 === 0);
        } else if (dailySchedule === 'specific-days' && selectedDays.length > 0) {
          isDayEligible = selectedDays.includes(dayOfWeekShort);
        }

        if (isDayEligible) {
          if (mode === 'specific-time' && specificTimes.length > 0) {
            specificTimes.forEach(time => {
              const [h, m] = time.split(':').map(Number);
              const doseDate = new Date(dayIterator);
              doseDate.setHours(h, m, 0, 0);
              if (doseDate.getTime() >= startDate.getTime() && doseDate.getTime() <= endDate.getTime()) {
                allCalculatedDoses.push(doseDate);
              }
            });
          } else if (mode === 'simple') {
            const numDoses = parseInt(simpleCount || '0');
            if (numDoses > 0) {
              const intervalMs = durationToDecimal(intervalDuration || '00:00') * 60 * 60 * 1000;

              let firstDoseOfDay = new Date(dayIterator);
              firstDoseOfDay.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);

              for (let i = 0; i < numDoses; i++) {
                const doseTime = new Date(firstDoseOfDay.getTime() + (i * intervalMs));

                if (doseTime.getDate() !== dayIterator.getDate() || doseTime.getMonth() !== dayIterator.getMonth() || doseTime.getFullYear() !== dayIterator.getFullYear()) {
                  continue;
                }

                if (doseTime.getTime() >= startDate.getTime() && doseTime.getTime() <= endDate.getTime()) {
                  allCalculatedDoses.push(doseTime);
                }
              }
            }
          }
        }
        dayIterator.setDate(dayIterator.getDate() + 1);
      }
    }

    const uniqueDosesMap = new Map<string, { date: Date; time: string; id: string; }>();
    allCalculatedDoses.forEach(dose => {
      const id = dose.toISOString();
      if (!uniqueDosesMap.has(id)) {
        uniqueDosesMap.set(id, {
          id,
          date: dose,
          time: dose.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        });
      }
    });

    const filteredAndSortedDoses = Array.from(uniqueDosesMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (filteredAndSortedDoses.length === 0 && (type === 'frequency' || type === 'punctual-frequency')) {
      return { needsDetail: true, message: "Aucune prise calculable avec les paramètres actuels. Vérifiez la durée et la fréquence.", cards: [], allDosesMap: new Map(), isError: false };
    }

    return { needsDetail: true, message: null, cards: filteredAndSortedDoses, allDosesMap: uniqueDosesMap, isError: false };
  }, [formData]);

  const doseScheduleCards = getDoseScheduleCards;

  const handleValidate = () => {
    if (!validationState.validation_autorisee) {
      alert(validationState.alerte.message);
      setIsSubmitted(false);
      return;
    }

    const drugName = formData.commercialName ? formData.commercialName : formData.molecule;
    const commercialSuffix = formData.commercialName ? `(${formData.molecule})` : '(Générique)';

    let summaryText = `${drugName} ${commercialSuffix} — ${formData.qty === '--' ? '0' : formData.qty} ${formData.unit}`;
    summaryText += ` (${formData.route})`;

    let solventSummary = '';
    if (formData.dilutionRequired && formData.solvent && formData.solvent.molecule && formData.solvent.qty !== '--' && formData.solvent.unit) {
      const sName = formData.solvent.commercialName || formData.solvent.molecule;
      solventSummary = ` dilué dans ${formData.solvent.qty} ${formData.solvent.unit} de ${sName}`;
    }
    summaryText += solventSummary;


    if (formData.adminMode === 'continuous') {
      summaryText += ` sur ${formatDuration(formData.adminDuration)}`;
    } else if (formData.adminMode === 'permanent') {
      summaryText += ` en continu`;
    }

    if (formData.adminMode !== 'permanent' && formData.type === 'one-time') {
      const date = new Date(formData.schedule.startDateTime).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      summaryText += ` • Prise unique le ${date}`;
    } else if (formData.adminMode !== 'permanent') {
      let freqText = "";
      if (formData.schedule.mode === 'cycle') {
        const intervalText = formData.schedule.isCustomInterval ? formData.schedule.interval : formData.schedule.interval;
        freqText = `Toutes les ${intervalText} heures`;
      } else if (formData.schedule.mode === 'simple') {
        const numDoses = parseInt(formData.schedule.simpleCount || '0');
        const intervalDuration = formData.schedule.intervalDuration;
        freqText = `, ${numDoses} fois par jour`;
        if (numDoses > 1 && intervalDuration && durationToDecimal(intervalDuration) > 0) {
          freqText += `, avec un intervalle de ${formatDuration(intervalDuration)} entre chaque prise`;
        }
      } else {
        freqText = "Aux heures : " + (formData.schedule.specificTimes && Array.isArray(formData.schedule.specificTimes) && formData.schedule.specificTimes.length > 0 ? formData.schedule.specificTimes.join(', ') : "?");
      }

      const date = new Date(formData.schedule.startDateTime).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
      const durationUnitFr = formData.schedule.durationUnit === 'days' ? 'jours' : 'semaines';

      let scheduleDetails = "";
      if (formData.schedule.dailySchedule === 'everyday') {
        scheduleDetails = "Tous les jours";
      } else if (formData.schedule.dailySchedule === 'every-other-day') {
        scheduleDetails = "Un jour sur deux";
      } else {
        scheduleDetails = (formData.schedule.selectedDays && formData.schedule.selectedDays.length > 0) ? formData.schedule.selectedDays.join(', ') : "Jours non définis";
      }

      let startText = "";
      if (formData.type === 'punctual-frequency') {
        startText = ` • 1 prise immédiatement, puis ${scheduleDetails.toLowerCase()}`;
      } else {
        startText = ` • ${scheduleDetails}`;
      }

      summaryText += `${startText}, ${freqText} à partir du ${date} pendant ${formData.schedule.durationValue === '--' ? '0' : formData.schedule.durationValue} ${durationUnitFr}`;
    } else if (formData.adminMode === 'permanent') {
      const date = new Date(formData.schedule.startDateTime).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      const durationUnitFr = formData.schedule.durationUnit === 'days' ? 'jours' : 'semaines';
      summaryText += ` • Pendant ${formData.schedule.durationValue === '--' ? '0' : formData.schedule.durationValue} ${durationUnitFr} à partir du ${date}`;
    }

    if (formData.conditionComment && formData.conditionComment.trim().length > 0) {
      summaryText += ` • Commentaire: ${formData.conditionComment.trim()}`;
    }


    setSummary(summaryText);
    if (onSave) {
      onSave(formData);
    }
    setIsSubmitted(true);
  };

  const clearForm = () => {
    setFormData({
      molecule: "",
      commercialName: "",
      qty: "--",
      unit: "mg",
      route: "Orale",
      adminMode: "instant",
      adminDuration: "",
      type: "frequency",
      dilutionRequired: false,
      substitutable: true,
      solvent: {
        molecule: "",
        commercialName: "",
        qty: "--",
        unit: "mL",
      },
      databaseMode: 'hospital',
      schedule: {
        dailySchedule: "everyday",
        mode: "cycle",
        interval: "",
        isCustomInterval: false,
        startDateTime: getCurrentDateTime(),
        durationValue: "--",
        durationUnit: "days",
        selectedDays: [],
        specificTimes: [],
        simpleCount: "1",
        simplePeriod: "day",
        intervalDuration: "",
      },
      conditionComment: "",
    });
    setFilteredCommercialNames([]);
    setShowCommercialSuggestions(false);
    setFilteredMoleculeNames([]);
    setShowMoleculeSuggestions(false);
    setSolventFilteredMoleculeNames([]);
    setShowSolventMoleculeSuggestions(false);
    setSolventFilteredCommercialNames([]);
    setShowSolventCommercialSuggestions(false);
    setSummary(null);
    setIsSubmitted(false);
    setSkippedDoseIds(new Set());
  };

  const handleToggleDoseSkipped = useCallback((doseId: string) => {
    setSkippedDoseIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(doseId)) {
        newSet.delete(doseId);
      } else {
        newSet.add(doseId);
      }
      return newSet;
    });
  }, []);

  const skippedDosesSummary = useMemo(() => {
    if (!doseScheduleCards || !doseScheduleCards.allDosesMap || skippedDoseIds.size === 0 || formData.type === 'one-time') return null;

    const skippedDetails: Array<{ date: Date; time: string; }> = [];
    skippedDoseIds.forEach(id => {
      const doseDetail = doseScheduleCards.allDosesMap.get(id);
      if (doseDetail) {
        skippedDetails.push({ date: doseDetail.date, time: doseDetail.time });
      }
    });

    skippedDetails.sort((a, b) => a.date.getTime() - b.date.getTime());

    return (
      <div className="mt-4 p-3 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-100 flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-bold">Prises sautées :</h4>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            {skippedDetails.map((dose, index) => (
              <li key={index}>{dose.date.toLocaleDateString('fr-FR')} à {dose.time}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }, [skippedDoseIds, doseScheduleCards.allDosesMap, formData.type]);

  const isSpecificTimeRestricted = formData.type === 'punctual-frequency' && formData.schedule.mode === 'specific-time' && formData.schedule.specificTimes.length > 0;

  return (
    <div className="flex flex-col gap-6 relative">

      {/* CALENDAR MODAL OVERLAY */}
      {showCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-semibold text-lg">Sélectionner la date</h3>
              <button type="button" onClick={() => setShowCalendar(false)} className="hover:bg-white/20 p-1 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Body */}
            <div className="p-5">
              {/* Month Navigation */}
              <div className="flex justify-between items-center mb-4">
                <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-bold text-slate-800 text-lg capitalize">
                  {MONTHS_FR[pickerDate.getMonth()]} {pickerDate.getFullYear()}
                </span>
                <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 mb-2 text-center">
                {DAYS.map(d => (
                  <div key={d} className="text-xs font-semibold text-slate-400 uppercase py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-6">
                {/* Empty slots for start of month */}
                {Array.from({ length: getFirstDayOfMonth(pickerDate.getFullYear(), pickerDate.getMonth()) }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-9"></div>
                ))}

                {/* Days */}
                {Array.from({ length: getDaysInMonth(pickerDate.getFullYear(), pickerDate.getMonth()) }).map((_, i) => {
                  const day = i + 1;
                  const isSelected = tempSelectedDate
                    && tempSelectedDate.getDate() === day
                    && tempSelectedDate.getMonth() === pickerDate.getMonth()
                    && tempSelectedDate.getFullYear() === pickerDate.getFullYear();

                  const isDisabled = isDateDisabled(day);

                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => handleDateClick(day)}
                      disabled={isDisabled}
                      className={`h-9 w-9 rounded-full text-sm font-medium flex items-center justify-center transition-all ${isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105'
                        : isDisabled
                          ? 'text-slate-300 cursor-not-allowed bg-slate-50'
                          : 'text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Time Selection */}
              <div className="bg-slate-50 p-3 rounded-xl mb-6 border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Heure de début
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                  <select
                    value={tempTime}
                    onChange={(e) => setTempTime(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 h-12 bg-white border border-slate-200 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 text-lg cursor-pointer hover:border-indigo-300 transition-colors"
                  >
                    <option value="" disabled>--:--</option>
                    {TIME_SLOTS.map(t => (
                      <option key={t} value={t} disabled={isTimeDisabled(t)} className={isTimeDisabled(t) ? 'text-slate-300 bg-slate-50' : ''}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCalendar(false)}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmDateTime}
                  disabled={!tempTime}
                  className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition ${!tempTime
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                    }`}
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEFT COLUMN: FORM */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

          <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <Pill className="text-white w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Détails du Composé</h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Database Mode Toggle */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Base de Données</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleDatabaseModeChange('hospital')}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${formData.databaseMode === 'hospital' ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Base Hôpital
                </button>
                <button
                  type="button"
                  onClick={() => handleDatabaseModeChange('universal')}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${formData.databaseMode === 'universal' ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Base Universelle
                </button>
              </div>
            </div>

            {/* Molecule Search */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Principe Actif (Molécule) <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Rechercher une molécule (ex: Paracétamol)..."
                    className="w-full pl-10 pr-4 py-3 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
                    value={formData.molecule}
                    onChange={handleMoleculeChange}
                    onFocus={() => setShowMoleculeSuggestions(formData.molecule.length > 0 && filteredMoleculeNames.length > 0)}
                    onBlur={() => setTimeout(() => setShowMoleculeSuggestions(false), 100)}
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                  {showMoleculeSuggestions && filteredMoleculeNames.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                      {filteredMoleculeNames.map((mol) => (
                        <button
                          type="button"
                          key={mol}
                          onClick={() => handleMoleculeSuggestionClick(mol)}
                          className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          {mol}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Suggestions Hint */}
                {formData.molecule.length > 0 && filteredMoleculeNames.length === 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg w-fit">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Molécule non trouvée dans la base locale (saisie libre)</span>
                  </div>
                )}
              </div>

              {/* Commercial Name Autocomplete */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom Commercial (Optionnel)</label>
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Rechercher un nom commercial (ex: Doliprane)..."
                    className="w-full pl-10 pr-4 py-3 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
                    value={formData.commercialName}
                    onChange={handleCommercialNameChange}
                    onFocus={handleCommercialNameFocus}
                    onBlur={() => setTimeout(() => setShowCommercialSuggestions(false), 100)}
                  />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                  {showCommercialSuggestions && filteredCommercialNames.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                      {filteredCommercialNames.map((brand) => (
                        <button
                          type="button"
                          key={brand}
                          onClick={() => handleCommercialSuggestionClick(brand)}
                          className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dosage & Route Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Qty */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Dosage <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="--"
                    className="w-full px-4 py-3 h-12 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-800"
                    value={formData.qty === '--' ? '' : formData.qty}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        updateField('qty', '--');
                      } else {
                        updateField('qty', val);
                      }
                    }}
                  />
                </div>
                {/* Unit */}
                <div className="md:col-span-3">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Unité <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      className="w-full pl-3 pr-8 h-12 bg-white border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                      value={formData.unit}
                      onChange={(e) => updateField('unit', e.target.value)}
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                {/* Route */}
                <div className="md:col-span-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Voie d'administration <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select
                      className="w-full pl-3 pr-8 h-12 bg-white border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium truncate"
                      value={formData.route}
                      onChange={(e) => updateField('route', e.target.value)}
                    >
                      {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Substitutable Toggle */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Substituable</label>
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => updateField('substitutable', true)}
                    className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${formData.substitutable ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    Oui
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('substitutable', false)}
                    className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${!formData.substitutable ? 'bg-white text-red-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    Non
                  </button>
                </div>
              </div>
            </div>

            {/* Condition / Commentaire */}
            <div className="mt-6">
              <label htmlFor="conditionComment" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Condition / Commentaire (Optionnel)
              </label>
              <textarea
                id="conditionComment"
                rows={3}
                placeholder="Ajouter des conditions spéciales ou des commentaires..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400 resize-y"
                value={formData.conditionComment}
                onChange={(e) => updateField('conditionComment', e.target.value)}
              />
            </div>

            {/* Dilution Toggle */}
            <div className="mt-6 mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Dilution</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => updateField('dilutionRequired', true)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${formData.dilutionRequired ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Oui
                </button>
                <button
                  type="button"
                  onClick={() => updateField('dilutionRequired', false)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${!formData.dilutionRequired ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Non
                </button>
              </div>
            </div>

            {/* Solvant Details Section */}
            {formData.dilutionRequired && formData.solvent && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-indigo-600/10 px-6 py-4 flex items-center gap-3">
                  <div className="bg-indigo-600/20 p-2 rounded-lg backdrop-blur-sm">
                    <FlaskConical className="text-indigo-700 w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-indigo-700">Détails du Solvant</h2>
                </div>

                <div className="p-6 space-y-6">
                  {/* Solvent Molecule Search */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Molécule <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        placeholder="Rechercher une molécule de solvant (ex: Glucose)..."
                        className="w-full pl-10 pr-4 py-3 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
                        value={formData.solvent.molecule}
                        onChange={handleSolventMoleculeChange}
                        onFocus={() => setShowSolventMoleculeSuggestions(formData.solvent!.molecule.length > 0 && solventFilteredMoleculeNames.length > 0)}
                        onBlur={() => setTimeout(() => setShowSolventMoleculeSuggestions(false), 100)}
                      />
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      {showSolventMoleculeSuggestions && solventFilteredMoleculeNames.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                          {solventFilteredMoleculeNames.map((mol) => (
                            <button
                              type="button"
                              key={mol}
                              onClick={() => handleSolventMoleculeSuggestionClick(mol)}
                              className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              {mol}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Solvent Commercial Name Autocomplete */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom Commercial (Optionnel)</label>
                    <div className="relative group">
                      <input
                        type="text"
                        placeholder="Rechercher un nom commercial (ex: NaCl 0.9%)..."
                        className="w-full pl-10 pr-4 py-3 h-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400"
                        value={formData.solvent.commercialName}
                        onChange={handleSolventCommercialNameChange}
                        onFocus={handleSolventCommercialNameFocus}
                        onBlur={() => setTimeout(() => setShowSolventCommercialSuggestions(false), 100)}
                      />
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                      {showSolventCommercialSuggestions && solventFilteredCommercialNames.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                          {solventFilteredCommercialNames.map((brand) => (
                            <button
                              type="button"
                              key={brand}
                              onClick={() => handleSolventCommercialSuggestionClick(brand)}
                              className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              {brand}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Solvent Dosage & Unit Row */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    {/* Solvant Qty */}
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Dosage / Volume <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        min="0"
                        placeholder="--"
                        className="w-full px-4 py-3 h-12 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-800"
                        value={formData.solvent.qty === '--' ? '' : formData.solvent.qty}
                        onChange={(e) => {
                          const val = e.target.value;
                          const num = parseFloat(val);
                          if (val === '' || isNaN(num) || num <= 0) {
                            updateSolventField('qty', '--');
                          } else {
                            updateSolventField('qty', val);
                          }
                        }}
                      />
                    </div>
                    {/* Solvant Unit */}
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Unité <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select
                          className="w-full pl-3 pr-8 h-12 bg-white border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                          value={formData.solvent.unit}
                          onChange={(e) => updateSolventField('unit', e.target.value)}
                        >
                          {UNITS.filter(u => ['mL', 'g', 'mg'].includes(u)).map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Administration Mode Toggle & Duration */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm self-start">
                  <button
                    type="button"
                    onClick={() => updateField('adminMode', 'instant')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${formData.adminMode === 'instant' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Prise instantanée
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('adminMode', 'continuous')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${formData.adminMode === 'continuous' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Sur une durée
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('adminMode', 'permanent')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${formData.adminMode === 'permanent' ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    En continu
                  </button>
                </div>

                {formData.adminMode === 'continuous' && (
                  <div className="flex-1 max-w-[200px] animate-in fade-in slide-in-from-left-2 duration-300">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Durée (Heures:Minutes) <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          placeholder="00"
                          value={parseDuration(formData.adminDuration).h.toString()}
                          onChange={(e) => handleManualTimeChange('hours', e.target.value, 'adminDuration')}
                          className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none ${validationState.alerte.message.includes(OVERLAP_ERROR_MSG) ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'}`}
                        />
                      </div>
                      <span className="font-bold text-slate-400">:</span>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          placeholder="00"
                          value={parseDuration(formData.adminDuration).m.toString()}
                          onChange={(e) => handleManualTimeChange('minutes', e.target.value, 'adminDuration')}
                          className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none ${validationState.alerte.message.includes(OVERLAP_ERROR_MSG) ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'}`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Full width error message for overlap */}
              {formData.adminMode === 'continuous' && validationState.alerte.active && validationState.alerte.message.includes(OVERLAP_ERROR_MSG) && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700 font-medium leading-relaxed">{OVERLAP_ERROR_MSG}</p>
                </div>
              )}
              {/* Full width error message for specificAdminIntervalError */}
              {formData.adminMode === 'continuous' && validationState.alerte.active && validationState.alerte.message.includes(SPECIFIC_ADMIN_INTERVAL_ERROR) && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700 font-medium leading-relaxed">{SPECIFIC_ADMIN_INTERVAL_ERROR}</p>
                </div>
              )}
              {/* Full width error message for CYCLIC_ADMIN_INTERVAL_ERROR */}
              {formData.adminMode === 'continuous' && validationState.alerte.active && validationState.alerte.message.includes(CYCLIC_ADMIN_INTERVAL_ERROR) && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700 font-medium leading-relaxed">{CYCLIC_ADMIN_INTERVAL_ERROR}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: CALENDAR D'ADMINISTRATION */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-indigo-600 px-6 py-4 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <Clock className="text-white w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-white">Calendrier d'Administration</h2>
          </div>

          <div className="p-6 space-y-6">
            {formData.adminMode !== 'permanent' && (
              <>
                {/* Type Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('frequency')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${formData.type === 'frequency'
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    <Activity className="w-4 h-4" /> Fréquence
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('punctual-frequency')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${formData.type === 'punctual-frequency'
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Ponct + Freq</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('one-time')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${formData.type === 'one-time'
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    <Syringe className="w-4 h-4" /> Prise unique
                  </button>
                </div>

                {/* Conditional Schedule Content */}
                <div className="min-h-[160px]">
                  {formData.type === 'frequency' || formData.type === 'punctual-frequency' ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">

                      {/* IMMEDIATE DOSE BLOCK (Only for punctual-frequency) */}
                      {formData.type === 'punctual-frequency' && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                          <div className="bg-white p-2 rounded-full border border-indigo-100 shadow-sm">
                            <Zap className="w-5 h-5 text-indigo-600 fill-indigo-100" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                              Prise Immédiate
                              <span className="bg-indigo-200 text-indigo-800 text-[10px] uppercase px-1.5 py-0.5 rounded font-bold tracking-wide">Automatique</span>
                            </h4>
                            <p className="text-xs text-indigo-700 mt-0.5">Une prise unique sera générée pour <strong>maintenant</strong>.</p>
                          </div>
                        </div>
                      )}

                      {/* Daily Schedule Radio */}
                      <div className="flex gap-6">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.schedule.dailySchedule === 'everyday' ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                            {formData.schedule.dailySchedule === 'everyday' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                          </div>
                          <span className={`text-sm font-medium ${formData.schedule.dailySchedule === 'everyday' ? 'text-indigo-900' : 'text-slate-600'}`}>Tous les jours</span>
                          <input type="radio" className="hidden" checked={formData.schedule.dailySchedule === 'everyday'} onChange={() => handleDailyScheduleChange('everyday')} />
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.schedule.dailySchedule === 'every-other-day' ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                            {formData.schedule.dailySchedule === 'every-other-day' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                          </div>
                          <span className={`text-sm font-medium ${formData.schedule.dailySchedule === 'every-other-day' ? 'text-indigo-900' : 'text-slate-600'}`}>1 jour / 2</span>
                          <input type="radio" className="hidden" checked={formData.schedule.dailySchedule === 'every-other-day'} onChange={() => handleDailyScheduleChange('every-other-day')} />
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.schedule.dailySchedule === 'specific-days' ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                            {formData.schedule.dailySchedule === 'specific-days' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                          </div>
                          <span className={`text-sm font-medium ${formData.schedule.dailySchedule === 'specific-days' ? 'text-indigo-900' : 'text-slate-600'}`}>Jours spécifiques</span>
                          <input type="radio" className="hidden" checked={formData.schedule.dailySchedule === 'specific-days'} onChange={() => handleDailyScheduleChange('specific-days')} />
                        </label>
                      </div>

                      {/* Specific Days Selector */}
                      {formData.schedule.dailySchedule === 'specific-days' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                          <div className="flex gap-2 w-full">
                            {DAYS.map((day) => {
                              const isSelected = formData.schedule.selectedDays?.includes(day);
                              return (
                                <button
                                  type="button"
                                  key={day}
                                  onClick={() => toggleDay(day)}
                                  className={`
                                                        flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-lg border-2 transition-all active:scale-95
                                                        ${isSelected
                                      ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-inner'
                                      : 'border-indigo-100 bg-white text-indigo-300 hover:border-indigo-300'}
                                                    `}
                                >
                                  {day}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Frequency Mode Selection - Always visible for frequency type */}
                      <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100/50">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xs font-bold text-indigo-900 uppercase tracking-widest">Mode de Fréquence</span>
                          <div className="flex bg-white rounded-lg border border-indigo-100 p-1 shadow-sm">
                            {/* Reordered buttons here */}
                            {['cycle', 'specific-time', 'simple'].map((m) => (
                              <button
                                type="button"
                                key={m}
                                onClick={() => updateSchedule('mode', m)}
                                disabled={(formData.schedule.dailySchedule === 'every-other-day' || formData.schedule.dailySchedule === 'specific-days') && m === 'cycle'}
                                className={`px-3 py-2 text-sm font-semibold rounded-md transition-all ${formData.schedule.mode === m
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'text-slate-500 hover:text-slate-700'
                                  } ${((formData.schedule.dailySchedule === 'every-other-day' || formData.schedule.dailySchedule === 'specific-days') && m === 'cycle') ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {m === 'simple' ? 'Simple' : m === 'cycle' ? 'Cyclique' : 'Heure Fixe'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {formData.schedule.mode === 'cycle' ? (
                          <div className="animate-in fade-in slide-in-from-bottom-2">
                            <label className="block text-sm font-medium text-indigo-900 mb-2">Répéter toutes les :</label>
                            <div className="flex flex-wrap gap-2">
                              {/* Added '2h' option */}
                              {['2', '4', '6', '8', '12', '24'].map((hr) => (
                                <button
                                  type="button"
                                  key={hr}
                                  onClick={() => handleIntervalSelect(hr)}
                                  className={`flex-1 min-w-[60px] py-2 text-sm font-medium border rounded-lg transition-all active:scale-95 ${!formData.schedule.isCustomInterval && formData.schedule.interval === hr
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                                    : 'bg-white text-slate-600 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                                    }`}
                                >
                                  {hr}h
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={handleCustomInterval}
                                className={`px-4 py-2 text-sm font-medium border rounded-lg transition-all ${formData.schedule.isCustomInterval
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-600 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                                  }`}
                              >
                                Autre
                              </button>
                            </div>
                            {formData.schedule.isCustomInterval && (
                              <div className="mt-3 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                <input
                                  type="number"
                                  value={formData.schedule.interval}
                                  onChange={(e) => updateSchedule('interval', e.target.value)}
                                  className="w-24 p-2 text-sm text-center font-bold text-indigo-800 bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                  autoFocus
                                />
                                <span className="text-sm font-medium text-indigo-800">heures</span>
                              </div>
                            )}
                            {validationState.alerte.active && validationState.alerte.message.includes(CYCLIC_ADMIN_INTERVAL_ERROR) && (
                              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-red-700 font-medium leading-relaxed">{CYCLIC_ADMIN_INTERVAL_ERROR}</p>
                              </div>
                            )}
                          </div>
                        ) : formData.schedule.mode === 'simple' ? (
                          <div className="animate-in fade-in slide-in-from-bottom-2">
                            <label className="block text-sm font-medium text-indigo-900 mb-2">Fréquence :</label>
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min="1"
                                value={formData.schedule.simpleCount}
                                onChange={(e) => updateSchedule('simpleCount', e.target.value)}
                                className="w-20 p-2 text-center text-sm font-bold text-indigo-800 bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                              <span className="text-sm font-semibold text-indigo-700">fois par jours</span>
                              {/* Durée inter-prises */}
                              {/* Always show, but make interaction conditional if simpleCount === 1 */}
                              <div className="flex items-center gap-1.5 ml-4">
                                <label className="block text-xs font-semibold text-slate-500">Durée inter-prises:</label>
                                <div className="flex flex-col"> {/* Use flex-col wrapper */}
                                  <div className="flex items-center gap-2">
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="00"
                                        value={parseDuration(formData.schedule.intervalDuration || '00:00').h.toString()}
                                        onChange={(e) => handleManualTimeChange('hours', e.target.value, 'schedule.intervalDuration')}
                                        disabled={parseInt(formData.schedule.simpleCount || '0') <= 1} // Disable if 1 dose or less
                                        className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${parseInt(formData.schedule.simpleCount || '0') <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      />
                                    </div>
                                    <span className="font-bold text-slate-400">:</span>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        placeholder="00"
                                        value={parseDuration(formData.schedule.intervalDuration || '00:00').m.toString()}
                                        onChange={(e) => handleManualTimeChange('minutes', e.target.value, 'schedule.intervalDuration')}
                                        disabled={parseInt(formData.schedule.simpleCount || '0') <= 1} // Disable if 1 dose or less
                                        className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${parseInt(formData.schedule.simpleCount || '0') <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Full width error message for specificAdminIntervalError */}
                            {validationState.alerte.active && validationState.alerte.message.includes(SPECIFIC_ADMIN_INTERVAL_ERROR) && (
                              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-red-700 font-medium leading-relaxed">{SPECIFIC_ADMIN_INTERVAL_ERROR}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            {/* Standard Times Buttons */}
                            <div className="flex gap-3">
                              {STANDARD_TIMES.map(({ label, time, icon: Icon }) => {
                                const isSelected = formData.schedule.specificTimes.includes(time);
                                return (
                                  <button
                                    type="button"
                                    key={label}
                                    onClick={() => toggleSpecificTime(time)}
                                    className={`flex-1 py-2.5 px-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${isSelected
                                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                                      : 'bg-white border-indigo-100 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                                      }`}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <Icon className="w-4 h-4" />
                                      <span className="font-bold text-sm">{label}</span>
                                    </div>
                                    <span className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>{time}</span>
                                  </button>
                                )
                              })}
                            </div>

                            {/* Custom Time Dropdown */}
                            <div>
                              <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wide mb-2">
                                Ajouter une heure personnalisée
                              </label>
                              <div className="relative">
                                <select
                                  onChange={addCustomTime}
                                  className="w-full pl-3 pr-10 py-2.5 h-12 bg-white border border-indigo-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 cursor-pointer hover:border-indigo-400 transition-colors"
                                  value=""
                                >
                                  <option value="" disabled>Sélectionner une heure...</option>
                                  {HOURS_24.map(h => (
                                    <option key={h} value={h} disabled={formData.schedule.specificTimes.includes(h)}>
                                      {h}
                                    </option>
                                  ))}
                                </select>
                                <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                              </div>
                            </div>

                            {/* Selected Times Chips */}
                            {formData.schedule.specificTimes && formData.schedule.specificTimes.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-2">
                                {formData.schedule.specificTimes.sort().map(time => (
                                  <div
                                    key={time}
                                    className="group flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white border border-indigo-100 rounded-full shadow-sm text-indigo-700 text-sm font-bold animate-in zoom-in-95"
                                  >
                                    <span>{time}</span>
                                    <button
                                      type="button"
                                      onClick={() => toggleSpecificTime(time)}
                                      className="p-1 rounded-full hover:bg-red-50 text-indigo-300 hover:text-red-500 transition-colors"
                                      title="Supprimer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {(!formData.schedule.specificTimes || formData.schedule.specificTimes.length === 0) && (
                              <p className="text-xs text-center text-slate-400 italic py-2">Aucune heure sélectionnée</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-right-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-amber-800">Administration Unique</h4>
                        <p className="text-xs text-amber-700 mt-1">Ce médicament sera administré une seule fois à la date et l'heure indiquées.</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="h-px bg-slate-100 w-full" />
              </>
            )}

            {/* Date & Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date de Début <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    min={getMinDateTimeForInput()}
                    className={`w-full pl-3 pr-10 py-2.5 h-12 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 [&::-webkit-calendar-picker-indicator]:hidden ${validationState.alerte.message.includes(OVERLAP_ERROR_MSG) ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'} ${isSpecificTimeRestricted ? 'bg-slate-100 cursor-pointer' : 'bg-slate-50'}`}
                    value={formData.schedule.startDateTime}
                    onChange={(e) => updateSchedule('startDateTime', e.target.value)}
                    readOnly={isSpecificTimeRestricted}
                    onClick={(e) => {
                      if (isSpecificTimeRestricted) {
                        e.preventDefault();
                        openCalendarModal();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={openCalendarModal}
                    className="absolute right-1 top-1 bottom-1 aspect-square bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm z-10"
                    title="Ouvrir le calendrier"
                  >
                    <Calendar className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {(formData.type === 'frequency' || formData.type === 'punctual-frequency' || formData.adminMode === 'permanent') && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Durée de Traitement <span className="text-red-500">*</span></label>
                  <div className="flex shadow-sm rounded-xl overflow-hidden border border-slate-200 h-12">
                    <input
                      type="number"
                      min="1"
                      placeholder="--"
                      className="flex-1 text-center bg-white outline-none text-sm font-medium h-full selection:bg-indigo-100 border-none focus:ring-0 p-2"
                      value={formData.schedule.durationValue === '--' ? '' : formData.schedule.durationValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || parseInt(val) <= 0) {
                          updateSchedule('durationValue', '--');
                        } else {
                          updateSchedule('durationValue', val);
                        }
                      }}
                    />
                    <div className="w-px bg-slate-200"></div>
                    <button
                      type="button"
                      onClick={() => updateSchedule('durationUnit', formData.schedule.durationUnit === 'days' ? 'weeks' : 'days')}
                      className="w-1/2 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-600 transition"
                    >
                      {formData.schedule.durationUnit === 'days' ? 'Jours' : 'Semaines'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Overlap Error Message Full Width */}
            {validationState.alerte.active && validationState.alerte.message.includes(OVERLAP_ERROR_MSG) && (
              <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700 font-medium leading-relaxed">{OVERLAP_ERROR_MSG}</p>
              </div>
            )}

            {/* Dose Schedule Cards Section - RESTORED HERE */}
            {doseScheduleCards.needsDetail && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Détail des Prises</h3>
                {doseScheduleCards.message ? (
                  <div className={`flex items-start gap-3 p-3 rounded-lg ${doseScheduleCards.isError
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'text-slate-500 bg-slate-50 border border-slate-100'
                    }`}>
                    <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${doseScheduleCards.isError ? 'text-red-600' : 'text-slate-400'}`} />
                    <span className={`${doseScheduleCards.isError ? 'font-bold text-base md:text-lg' : 'text-sm'}`}>
                      {doseScheduleCards.message}
                    </span>
                  </div>
                ) : doseScheduleCards.cards.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {doseScheduleCards.cards.map((dose) => {
                      const isSkipped = skippedDoseIds.has(dose.id);
                      const isOneTime = formData.type === 'one-time';
                      const isImmediate = formData.type === 'punctual-frequency' && doseScheduleCards.cards.length > 0 && dose.date.getTime() === doseScheduleCards.cards[0].date.getTime();

                      return (
                        <div key={dose.id} className={`flex items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm transition-colors ${isSkipped && !isOneTime ? 'opacity-60 bg-red-50 border-red-100 line-through' : 'text-blue-800'}`}>
                          <div className="flex items-center gap-3">
                            {isImmediate ? (
                              <Zap className="w-4 h-4 flex-shrink-0 text-amber-500 fill-amber-500" />
                            ) : (
                              <Clock className={`w-4 h-4 flex-shrink-0 ${isSkipped && !isOneTime ? 'text-red-600' : 'text-blue-600'}`} />
                            )}
                            <span className={`${isSkipped && !isOneTime ? 'text-red-700' : 'text-blue-800'}`}>
                              {isImmediate ?
                                <span className="font-bold flex items-center gap-1.5">
                                  Maintenant
                                  <span className="text-xs font-normal opacity-75">({dose.date.toLocaleDateString('fr-FR')} à {dose.time})</span>
                                </span>
                                : `${dose.date.toLocaleDateString('fr-FR')} à ${dose.time}`
                              }
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleDoseSkipped(dose.id)}
                            disabled={isOneTime || isImmediate}
                            className={`p-1 rounded-full ${isSkipped && !isOneTime ? 'bg-white text-red-500 hover:bg-red-100' : 'bg-white text-emerald-600 hover:bg-emerald-100'} transition-colors flex-shrink-0 ${(isOneTime || isImmediate) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={(isOneTime || isImmediate) ? 'Ne peut pas être sautée' : (isSkipped ? 'Marquer comme active' : 'Marquer comme sautée')}
                          >
                            {isSkipped && !isOneTime ? <X size={16} /> : <CheckCircle size={16} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center text-slate-400 py-4">
                    <Activity className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">Aucune prise calculable avec les paramètres actuels.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: PREVIEW & ACTION */}
      <div className="space-y-6">

        {/* Live Preview Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Aperçu de l'ordonnance</h3>

          <div className={`rounded-xl border-2 border-dashed p-6 transition-all duration-300 ${isSubmitted ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-slate-50'}`}>
            <PrescriptionCard formData={formData} extraContent={skippedDosesSummary} />
          </div>


          {/* Inter-dose duration warning */}
          {showInterDoseWarning && (
            <div className="mt-4 p-3 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200 flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
              <span>Vous avez choisi le mode simple mais n'avez pas rempli la durée inter-prise; cette prescription ne sera donc pas ajoutée à la fiche de surveillance.</span>
            </div>
          )}

          {/* Validation Errors / Status */}
          {validationState.alerte.active && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{validationState.alerte.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleValidate}
              disabled={!validationState.validation_autorisee}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {isSubmitted ? 'Mettre à jour' : "Valider l'Ordonnance"}
            </button>

            <button
              type="button"
              onClick={clearForm}
              className="w-full bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 font-semibold py-2.5 rounded-xl border border-slate-200 hover:border-red-200 transition-colors flex justify-center items-center gap-2 text-sm"
            >
              <X className="w-4 h-4" />
              Effacer
            </button>
          </div>
        </div>
      </div >
    </div >
  );
};