import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    Search, X, FileText,
    Clock, Calendar, Activity, Zap, Syringe, ChevronLeft, ChevronRight, ChevronDown,
    Droplet, Sun, SunMedium, Moon, BedDouble, AlertCircle, CheckCircle, Plus,
    Sunset, Pill, FlaskConical, TestTube, Timer, Edit2, Save, Undo2, RotateCcw,
    CalendarOff, ArrowRight, Trash2
} from 'lucide-react';
import { FormData, ScheduleData, PrescriptionType, DoseScheduleResult } from './types';
import { durationToDecimal, formatDuration, getPosologyText, FULL_DAYS_MAP, generateDoseSchedule } from './utils';
import { PrescriptionCard } from './PrescriptionCard';
import { DoseEditor } from './DoseEditor';

// --- CONSTANTS ---
// Specialized icons for transfusion products? using generic for now but distinct logic
const TRANSFUSION_PRODUCT_OPTS = [
    { id: 'CGR', label: 'C.G.R', fullName: 'Culot Globulaire (CGR)', icon: Droplet, color: 'text-red-600', activeBorder: 'border-red-500', activeBg: 'bg-red-50/50', activeDot: 'bg-red-500', activeText: 'text-red-900' },
    { id: 'PFC', label: 'P.F.C', fullName: 'Plasma Frais Congelé (PFC)', icon: Droplet, color: 'text-blue-600', activeBorder: 'border-blue-500', activeBg: 'bg-blue-50/50', activeDot: 'bg-blue-500', activeText: 'text-blue-900' },
    { id: 'Plaquettes', label: 'Plaquettes', fullName: 'Concentré Plaquettaire', icon: Droplet, color: 'text-amber-600', activeBorder: 'border-amber-500', activeBg: 'bg-amber-50/50', activeDot: 'bg-amber-500', activeText: 'text-amber-900' },
    { id: 'Cryoprecipite', label: 'Cryoprécipité', fullName: 'Cryoprécipité', icon: Droplet, color: 'text-indigo-600', activeBorder: 'border-indigo-500', activeBg: 'bg-indigo-50/50', activeDot: 'bg-indigo-500', activeText: 'text-indigo-900' }
];

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const TIME_SLOTS = Array.from({ length: 48 }).map((_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? '00' : '30';
    return `${String(h).padStart(2, '0')}:${m}`;
});

const STANDARD_TIMES = [
    { label: 'Matin', time: '08:00', icon: Sun },
    { label: 'Midi', time: '12:00', icon: SunMedium }, // Changed icon to avoid 'Sunset' if not imported
    { label: 'Soir', time: '20:00', icon: Moon },
];

const HOURS_24 = Array.from({ length: 24 }).map((_, i) => `${String(i).padStart(2, '0')}:${String(0).padStart(2, '0')}`);

const OVERLAP_ERROR_MSG = "Intervalle de durée entre la 1ère et la 2ème transfusion programmée < Durée de transfusion. Ajustez la durée de transfusion et / ou la date & heure de début choisies.";
const SPECIFIC_ADMIN_INTERVAL_ERROR = "Durée inter-prise doit être supérieure à la durée d'administration.";
const CYCLIC_ADMIN_INTERVAL_ERROR = "Le cycle de répétition ne peut pas être inférieur à la durée de transfusion.";

const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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


const parseDuration = (durationStr: string) => {
    if (!durationStr || durationStr === '00:00') return { h: 0, m: 0 };
    const [h, m] = durationStr.split(':').map(Number);
    return { h: h || 0, m: m || 0 };
};

interface TransfusionPrescriptionFormProps {
    onSave?: (data: FormData[]) => void;
}

export const TransfusionPrescriptionForm: React.FC<TransfusionPrescriptionFormProps> = ({ onSave }) => {
    // --- STATE ---

    // Product Selection State (Multi-select with Quantities)
    // Map of product ID -> Quantity (string)
    const [selectedProductsQty, setSelectedProductsQty] = useState<Record<string, string>>({});

    // General Fields
    const [comment, setComment] = useState('');
    const [transfusionDuration, setTransfusionDuration] = useState('02:00'); // Default 2h

    // Validation State
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [skippedDoseIds, setSkippedDoseIds] = useState<Set<string>>(new Set());

    // Schedule State (Identical structure to PrescriptionForm)
    const [scheduleData, setScheduleData] = useState<ScheduleData>({
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
    });

    const [prescriptionType, setPrescriptionType] = useState<PrescriptionType>('frequency');

    // Calendar Modal State
    const [showCalendar, setShowCalendar] = useState(false);
    const [pickerDate, setPickerDate] = useState(new Date());
    const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
    const [tempTime, setTempTime] = useState("");


    // --- HANDLERS ---

    const handleToggleProduct = (productId: string) => {
        setIsSubmitted(false);
        setSelectedProductsQty(prev => {
            const next = { ...prev };
            if (next[productId]) {
                delete next[productId];
            } else {
                next[productId] = '1'; // Default 1 unit
            }
            return next;
        });
    };

    const handleProductQtyChange = (productId: string, qty: string) => {
        setIsSubmitted(false);
        setSelectedProductsQty(prev => ({
            ...prev,
            [productId]: qty
        }));
    };

    const handleManualTimeChange = (type: 'hours' | 'minutes', val: string, field: 'duration' | 'interval') => {
        setIsSubmitted(false);
        let currentStr = field === 'duration' ? transfusionDuration : scheduleData.intervalDuration;
        if (!currentStr) currentStr = '00:00';

        let { h, m } = parseDuration(currentStr);
        const num = val === '' ? 0 : parseInt(val);

        if (type === 'hours') {
            h = isNaN(num) ? 0 : Math.max(0, num);
        } else {
            m = isNaN(num) ? 0 : Math.max(0, Math.min(59, num));
        }

        const newVal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        if (field === 'duration') {
            setTransfusionDuration(newVal);
        } else {
            setScheduleData(prev => ({ ...prev, intervalDuration: newVal }));
        }
    };


    // --- SCHEDULE HANDLERS (Copied logic) ---

    const handleTypeChange = (newType: PrescriptionType) => {
        setIsSubmitted(false);
        setPrescriptionType(newType);
        setScheduleData(prev => {
            const newSchedule = { ...prev };
            if (newType === 'punctual-frequency') {
                newSchedule.startDateTime = "";
            } else if (newType === 'frequency' && (!prev.startDateTime || prescriptionType === 'punctual-frequency')) {
                if (!prev.startDateTime) newSchedule.startDateTime = getCurrentDateTime();
            } else if (newType === 'one-time') {
                if (!prev.startDateTime) newSchedule.startDateTime = getCurrentDateTime();
            }
            return newSchedule;
        });
    };

    const updateSchedule = (field: keyof ScheduleData, value: any) => {
        setIsSubmitted(false);
        setScheduleData(prev => {
            const newSchedule = { ...prev, [field]: value };
            if (field === 'mode' && value === 'specific-time' && prescriptionType === 'punctual-frequency') {
                newSchedule.startDateTime = "";
            }
            return newSchedule;
        });
    };

    const handleDailyScheduleChange = (value: 'everyday' | 'every-other-day' | 'specific-days') => {
        setIsSubmitted(false);
        let newScheduleMode = scheduleData.mode;
        if ((value === 'every-other-day' || value === 'specific-days') && scheduleData.mode === 'cycle') {
            newScheduleMode = 'simple';
        }
        setScheduleData(prev => ({ ...prev, dailySchedule: value, mode: newScheduleMode }));
    };

    const toggleDay = (day: string) => {
        setIsSubmitted(false);
        setScheduleData(prev => ({
            ...prev,
            selectedDays: prev.selectedDays.includes(day)
                ? prev.selectedDays.filter(d => d !== day)
                : [...prev.selectedDays, day]
        }));
    };

    const handleIntervalSelect = (hr: string) => {
        updateSchedule('interval', hr);
        updateSchedule('isCustomInterval', false);
    };

    const handleCustomInterval = () => {
        updateSchedule('isCustomInterval', true);
        if (['2', '4', '6', '8', '12', '24'].includes(scheduleData.interval)) {
            updateSchedule('interval', '');
        }
    };

    const toggleSpecificTime = (time: string) => {
        setIsSubmitted(false);
        setScheduleData(prev => {
            const isRemoving = prev.specificTimes.includes(time);
            const newTimes = isRemoving
                ? prev.specificTimes.filter(t => t !== time)
                : [...prev.specificTimes, time].sort();

            let newStartDateTime = prev.startDateTime;
            if (prescriptionType === 'punctual-frequency' && prev.mode === 'specific-time') {
                if (newStartDateTime) {
                    const currentStartTime = newStartDateTime.split('T')[1];
                    if (!newTimes.includes(currentStartTime)) {
                        newStartDateTime = "";
                    }
                }
            }

            return { ...prev, specificTimes: newTimes, startDateTime: newStartDateTime };
        });
    };

    const addCustomTime = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTime = e.target.value;
        if (newTime && !scheduleData.specificTimes.includes(newTime)) {
            toggleSpecificTime(newTime);
        }
    };


    // --- CALENDAR LOGIC ---

    const openCalendarModal = () => {
        const currentStr = scheduleData.startDateTime;
        let initialDate = new Date();
        if (currentStr) {
            const d = new Date(currentStr);
            if (!isNaN(d.getTime())) initialDate = d;
        }
        setPickerDate(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
        setTempSelectedDate(initialDate);
        setTempTime("");
        setShowCalendar(true);
    };

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return (day === 0 ? 6 : day - 1);
    };

    const handlePrevMonth = () => setPickerDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth() - 1, 1));
    const handleNextMonth = () => setPickerDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth() + 1, 1));

    const isDateDisabled = (day: number) => {
        const targetDate = new Date(pickerDate.getFullYear(), pickerDate.getMonth(), day);
        targetDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return targetDate < today;
    };

    const isTimeDisabled = (time: string) => {
        if (!tempSelectedDate) return false;
        if (prescriptionType === 'punctual-frequency' && scheduleData.mode === 'specific-time' && scheduleData.specificTimes.length > 0) {
            if (!scheduleData.specificTimes.includes(time)) return true;
        }
        const selectedDateNormalized = new Date(tempSelectedDate);
        selectedDateNormalized.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDateNormalized.getTime() !== today.getTime()) return false;
        const [h, m] = time.split(':').map(Number);
        const now = new Date();
        if (h < now.getHours()) return true;
        if (h === now.getHours() && m <= now.getMinutes()) return true;
        return false;
    };

    const handleDateClick = (day: number) => {
        if (isDateDisabled(day)) return;
        setTempSelectedDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth(), day));
    };

    const confirmDateTime = () => {
        if (tempSelectedDate && tempTime) {
            const yyyy = tempSelectedDate.getFullYear();
            const mm = String(tempSelectedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(tempSelectedDate.getDate()).padStart(2, '0');
            updateSchedule('startDateTime', `${yyyy}-${mm}-${dd}T${tempTime}`);
            setShowCalendar(false);
        }
    };

    const isSpecificTimeRestricted = prescriptionType === 'punctual-frequency' && scheduleData.mode === 'specific-time' && scheduleData.specificTimes.length > 0;

    // --- VALIDATION LOGIC ---

    const getValidationState = () => {
        const errorMessages: string[] = [];

        // Products
        if (Object.keys(selectedProductsQty).length === 0) {
            errorMessages.push("Sélectionner au moins un produit sanguin");
        }
        for (const [pid, qty] of Object.entries(selectedProductsQty)) {
            const parsedQty = parseFloat(qty === '--' ? '0' : qty);
            if (!qty || isNaN(parsedQty) || parsedQty <= 0) {
                errorMessages.push(`Quantité invalide pour ${pid}`);
            }
        }

        // Duration of transfusion
        const durationAdminDecimal = durationToDecimal(transfusionDuration);
        if (!transfusionDuration || durationAdminDecimal <= 0) {
            errorMessages.push("Durée de transfusion requise (doit être > 0)");
        }

        // Schedule
        if (prescriptionType !== 'punctual-frequency' && !scheduleData.startDateTime) {
            errorMessages.push("Date de début requise");
        }

        if (['frequency', 'punctual-frequency'].includes(prescriptionType)) {
            const durationVal = parseFloat(scheduleData.durationValue === '--' ? '0' : scheduleData.durationValue);
            if (!scheduleData.durationValue || scheduleData.durationValue === '--' || isNaN(durationVal) || durationVal <= 0) {
                errorMessages.push("Durée de traitement requise (doit être > 0)");
            }
        }

        // Business Rules (Copied from PrescriptionForm)
        if (scheduleData.dailySchedule === 'every-other-day' && scheduleData.mode === 'cycle') {
            errorMessages.push('Le mode cyclique n\'est pas compatible avec la fréquence \'1 jour / 2\'');
        }
        if (scheduleData.dailySchedule === 'specific-days' && scheduleData.mode === 'cycle') {
            errorMessages.push('Le mode cyclique n\'est pas compatible avec la fréquence \'Jours spécifiques\'');
        }

        const interval = parseFloat(scheduleData.interval || '0') || 0;
        const isCycle = scheduleData.mode === 'cycle';
        if (isCycle && durationAdminDecimal > 0 && interval > 0 && durationAdminDecimal >= interval) {
            errorMessages.push(CYCLIC_ADMIN_INTERVAL_ERROR);
        }
        if (isCycle && (scheduleData.interval === "" || parseFloat(scheduleData.interval) <= 0) && prescriptionType !== 'one-time') {
            errorMessages.push('Cycle de prise manquant');
        }

        const selectedCount = scheduleData.selectedDays.length;
        const durationVal = parseFloat(scheduleData.durationValue === '--' ? '0' : scheduleData.durationValue);
        const durationInDays = scheduleData.durationUnit === 'weeks' ? durationVal * 7 : durationVal;
        const daysMode = (prescriptionType === 'frequency' || prescriptionType === 'punctual-frequency') && scheduleData.dailySchedule === 'specific-days';

        if (daysMode) {
            if (selectedCount === 0) {
                errorMessages.push('Sélectionner au moins un jour');
            }
            if (selectedCount > 0 && durationVal > 0 && selectedCount > durationInDays) {
                errorMessages.push('La durée du traitement doit être au moins égale au nombre de jours sélectionnés');
            }
        }

        const timeMode = (prescriptionType === 'frequency' || prescriptionType === 'punctual-frequency') && scheduleData.mode === 'specific-time';
        if (timeMode && (!scheduleData.specificTimes || !Array.isArray(scheduleData.specificTimes) || scheduleData.specificTimes.length === 0)) {
            errorMessages.push('Sélectionner au moins une heure de prise');
        }

        if (prescriptionType === 'punctual-frequency' && scheduleData.mode === 'specific-time' && scheduleData.specificTimes.length > 0 && scheduleData.startDateTime) {
            const startTimeStr = scheduleData.startDateTime.split('T')[1];
            if (!scheduleData.specificTimes.includes(startTimeStr)) {
                errorMessages.push("L'heure de début doit correspondre à une des heures fixes sélectionnées");
            }
        }

        // Interval between fixed times
        if (scheduleData.mode === 'specific-time' && scheduleData.specificTimes.length > 0) {
            const sortedTimes = [...scheduleData.specificTimes].sort();
            for (let i = 0; i < sortedTimes.length; i++) {
                const t1 = durationToDecimal(sortedTimes[i]);
                const t2 = durationToDecimal(sortedTimes[(i + 1) % sortedTimes.length]);
                let diff = t2 - t1;
                if (diff < 0) diff += 24;
                if (diff < durationAdminDecimal) {
                    errorMessages.push("L'intervalle entre certaines heures fixes est inférieur à la durée de transfusion");
                    break;
                }
            }
        }

        const simpleMode = (prescriptionType === 'frequency' || prescriptionType === 'punctual-frequency') && scheduleData.mode === 'simple';
        const numDoses = parseInt(scheduleData.simpleCount || '0');
        const intervalDurationDecimal = durationToDecimal(scheduleData.intervalDuration || '00:00');

        if (simpleMode) {
            if (!scheduleData.simpleCount || numDoses <= 0) {
                errorMessages.push('Indiquer une fréquence positive pour le mode Simple');
            } else if (numDoses > 1) {
                if (scheduleData.intervalDuration && intervalDurationDecimal > 0) {
                    const startDateObj = scheduleData.startDateTime ? new Date(scheduleData.startDateTime) : new Date();
                    const startTimeInMinutes = startDateObj.getHours() * 60 + startDateObj.getMinutes();
                    const lastDoseTimeInMinutes = startTimeInMinutes + (numDoses - 1) * intervalDurationDecimal * 60;
                    if (lastDoseTimeInMinutes >= 24 * 60) {
                        errorMessages.push('Les prises calculées dépassent la fin de la journée (Mode Simple). Veuillez ajuster la fréquence ou l\'intervalle.');
                    } else if (durationAdminDecimal > 0 && durationAdminDecimal >= intervalDurationDecimal) {
                        errorMessages.push(SPECIFIC_ADMIN_INTERVAL_ERROR);
                    }
                } else {
                    // No error for missing interval duration here, it's handled in getDoseScheduleCards
                }
            }
        }

        // OVERLAP ERROR CHECK for Punctual + Freq
        if (prescriptionType === 'punctual-frequency' && scheduleData.startDateTime && durationAdminDecimal > 0) {
            const now = new Date();
            const firstScheduledDate = new Date(scheduleData.startDateTime);
            const diffInHours = (firstScheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);

            if (diffInHours < durationAdminDecimal) {
                errorMessages.push(OVERLAP_ERROR_MSG);
            }
        }

        const isValid = errorMessages.length === 0;

        // Field-specific error flags for UI highlighting
        const errorsByField = {
            duration: errorMessages.includes(SPECIFIC_ADMIN_INTERVAL_ERROR) || errorMessages.includes('Les prises calculées dépassent la fin de la journée'),
            transfusionDuration: errorMessages.includes(CYCLIC_ADMIN_INTERVAL_ERROR) || errorMessages.includes("L'intervalle entre certaines heures fixes est inférieur à la durée de transfusion") || errorMessages.includes(OVERLAP_ERROR_MSG),
            cycle: errorMessages.includes(CYCLIC_ADMIN_INTERVAL_ERROR),
            simpleCount: errorMessages.includes('Les prises calculées dépassent la fin de la journée'),
            interval: errorMessages.includes(SPECIFIC_ADMIN_INTERVAL_ERROR) || errorMessages.includes('Les prises calculées dépassent la fin de la journée'),
            overlap: errorMessages.includes(OVERLAP_ERROR_MSG)
        };

        return {
            isValid,
            errors: errorMessages,
            errorsByField,
            alerte: {
                active: !isValid,
                message: isValid ? "" : `Manquant / Incohérence : ${errorMessages.join(', ')}.`
            },
            validation_autorisee: isValid
        };
    };

    const validationState = getValidationState();

    const getDoseScheduleCards = useMemo(() => {
        return generateDoseSchedule(scheduleData, prescriptionType);
    }, [scheduleData, prescriptionType]);

    const doseScheduleCards = getDoseScheduleCards;

    const handleValidate = () => {
        if (!validationState.isValid) {
            setIsSubmitted(true); // show errors
            return;
        }

        // Create one prescription object per selected product
        const manualAdjustmentsRecord: Record<string, string> = {};
        manualDoseAdjustments.forEach((date, id) => {
            manualAdjustmentsRecord[id] = date.toISOString();
        });

        const prescriptions: FormData[] = Object.entries(selectedProductsQty).map(([pid, qty]) => {
            const productDef = TRANSFUSION_PRODUCT_OPTS.find(p => p.id === pid);
            return {
                molecule: productDef?.fullName || pid,
                commercialName: productDef?.fullName || pid,
                prescriptionType: 'transfusion' as const,
                qty: qty,
                unit: 'poche(s)',
                route: 'IV',
                adminMode: 'continuous' as const,
                adminDuration: transfusionDuration,
                type: prescriptionType,
                dilutionRequired: false,
                databaseMode: 'hospital' as const,
                substitutable: false,
                skippedDoses: [],
                manualDoseAdjustments: manualAdjustmentsRecord,
                conditionComment: comment,
                schedule: scheduleData
            };
        });

        if (onSave) onSave(prescriptions);
    };

    // State for manual time adjustments (Key: Dose ID, Value: New Date)
    const [manualDoseAdjustments, setManualDoseAdjustments] = useState<Map<string, Date>>(new Map());
    const [editingDoseId, setEditingDoseId] = useState<string | null>(null);

    // Merge calculated doses with manual adjustments
    const finalDoses = useMemo(() => {
        if (!doseScheduleCards || !doseScheduleCards.cards) return [];

        // Clone and sort based on original calculation first
        const combined = doseScheduleCards.cards.map((d: any) => {
            const adjustedDate = manualDoseAdjustments.get(d.id);
            const originalDate = d.date;

            if (adjustedDate) {
                return {
                    ...d,
                    date: adjustedDate,
                    time: adjustedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    originalDate,
                    originalTime: originalDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    isModified: true
                };
            }
            return {
                ...d,
                originalDate,
                originalTime: originalDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                isModified: false
            };
        });

        // Re-sort in case shifts changed the order
        return combined.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
    }, [doseScheduleCards, manualDoseAdjustments]);

    // Safety Buffer
    const BUFFER_MINUTES = 5;

    // Helper to calculate safe bounds for editing a dose
    const getSafeBounds = useCallback((doseId: string) => {
        const index = finalDoses.findIndex(d => d.id === doseId);
        // Note: index validity checks (first/last) are done before opening edit, 
        // but we double check here to return valid bounds.
        // If index is 0 or len-1, we shouldn't really be editing.
        // But for bounds calculation:
        // Left bound: 
        //   If first dose (index 0) -> theoretically Start Date, but we exclude editing first dose.
        //   So we assume index > 0.
        //   Tprev = finalDoses[index-1]

        // Right bound:
        //   If last dose -> theoretically undefined/max, but we exclude editing last dose.
        //   So we assume index < len-1.
        //   Tnext = finalDoses[index+1]

        if (index <= 0 || index >= finalDoses.length - 1) return null;

        const prevDose = finalDoses[index - 1];
        const nextDose = finalDoses[index + 1];
        const currentDose = finalDoses[index];

        // Duration of transfusion (D)
        const durationHours = parseFloat(transfusionDuration) || 2;
        const durationMs = durationHours * 60 * 60 * 1000;
        const bufferMs = BUFFER_MINUTES * 60 * 1000;

        // Tprev + D + BUFFER <= Tnew
        const minTime = prevDose.date.getTime() + durationMs + bufferMs;

        // Tnew <= Tnext-D-BUFFER
        const maxTime = nextDose.date.getTime() - durationMs - bufferMs;

        return { min: new Date(minTime), max: new Date(maxTime), current: currentDose.date };
    }, [transfusionDuration, finalDoses]);

    useEffect(() => {
        // Reset manual adjustments if the main schedule parameters change significantly
        setManualDoseAdjustments(new Map());

        setEditingDoseId(null);
    }, [scheduleData, prescriptionType, transfusionDuration]);

    const handleSaveEdit = (doseId: string, newDate: Date) => {
        setManualDoseAdjustments(prev => {
            const next = new Map(prev);
            next.set(doseId, newDate);
            return next;
        });
        setEditingDoseId(null);
    };

    const handleResetDose = (doseId: string) => {
        setManualDoseAdjustments(prev => {
            const next = new Map(prev);
            next.delete(doseId);
            return next;
        });
    };

    const handleToggleDoseSkipped = useCallback((doseId: string) => {
        setSkippedDoseIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(doseId)) newSet.delete(doseId);
            else newSet.add(doseId);
            return newSet;
        });
    }, []);

    // Summary of modified doses for Preview & Comment
    const modifiedDosesSummary = useMemo(() => {
        if (!doseScheduleCards || !doseScheduleCards.allDosesMap || manualDoseAdjustments.size === 0) return null;

        const modifiedDetails: Array<{ originalDate: Date; newDate: Date; }> = [];
        manualDoseAdjustments.forEach((newDate, id) => {
            const originalDose = doseScheduleCards.allDosesMap.get(id);
            if (originalDose) {
                modifiedDetails.push({ originalDate: originalDose.date, newDate: newDate });
            }
        });

        if (modifiedDetails.length === 0) return null;

        modifiedDetails.sort((a, b) => a.newDate.getTime() - b.newDate.getTime());

        return (
            <div className="mt-2 p-3 bg-blue-50 text-blue-800 text-xs rounded-lg border border-blue-100 flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2">
                <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                    <h4 className="font-bold">Transfusion(s) modifiée(s) :</h4>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {modifiedDetails.map((dose, index) => (
                            <li key={index}>
                                <span className="line-through opacity-60 mr-2">
                                    {dose.originalDate.toLocaleDateString('fr-FR')} {dose.originalDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="font-bold">
                                    → {dose.newDate.toLocaleDateString('fr-FR')} {dose.newDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }, [manualDoseAdjustments, doseScheduleCards.allDosesMap]);

    const skippedDosesSummary = useMemo(() => {
        if (!doseScheduleCards || !doseScheduleCards.allDosesMap || skippedDoseIds.size === 0 || prescriptionType === 'one-time') return null;

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
                    <h4 className="font-bold">Transfusion(s) annulée(s) :</h4>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {skippedDetails.map((dose, index) => (
                            <li key={index}>{dose.date.toLocaleDateString('fr-FR')} à {dose.time}</li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }, [skippedDoseIds, doseScheduleCards.allDosesMap, prescriptionType]);

    // Pseudo-formData list for Preview components
    const previewListFormDatas: FormData[] = useMemo(() => {
        return Object.entries(selectedProductsQty).map(([pid, qty]) => {
            const productDef = TRANSFUSION_PRODUCT_OPTS.find(p => p.id === pid);
            // Construct comment with potential summary appended (not for preview component rendering, but for actual data structure if needed)
            // But for preview rendering, we might render the summary specifically. 
            // The Preview component usually takes conditionComment as a string. 
            // If we want it to show up in the preview card, we might need to append it to conditionComment HTML.
            // Or, we render the summary separate from the preview card list.

            return {
                molecule: productDef?.fullName || "Produit Sanguin",
                commercialName: productDef?.fullName || "",
                prescriptionType: 'transfusion',
                qty: qty,
                unit: 'poche(s)',
                route: 'IV',
                adminMode: 'continuous',
                adminDuration: transfusionDuration,
                type: prescriptionType,
                dilutionRequired: false,
                databaseMode: 'hospital',
                substitutable: false,
                skippedDoses: [], // Empty for preview to avoid per-card display; handled by grouped summary at bottom
                // We don't modify conditionComment here for the summary, because we want to render the summary once at the bottom of the list?
                // Or per card? 
                // The user request: "mentionne les transfusions modifiées dans l'appercu de l'ordonnace (comme avec les transfusion annulées)"
                // skippedDosesSummary is rendered separately below the list? I need to check the JSX.
                conditionComment: comment ? ('<span class="bg-yellow-100 px-1 rounded">' + comment + '</span>') : "",
                schedule: scheduleData
            };
        });
    }, [selectedProductsQty, transfusionDuration, prescriptionType, skippedDoseIds, comment, scheduleData]);

    return (
        <div className="flex flex-col gap-6 relative">
            <div className="space-y-6">
                {/* CALENDAR MODAL */}
                {showCalendar && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                                <h3 className="font-semibold text-lg">Sélectionner la date</h3>
                                <button type="button" onClick={() => setShowCalendar(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-5">
                                {/* Navigation */}
                                <div className="flex justify-between items-center mb-4">
                                    <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
                                    <span className="font-bold text-slate-800 text-lg capitalize">{MONTHS_FR[pickerDate.getMonth()]} {pickerDate.getFullYear()}</span>
                                    <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronRight className="w-5 h-5" /></button>
                                </div>
                                {/* Days */}
                                <div className="grid grid-cols-7 mb-2 text-center">
                                    {DAYS.map(d => <div key={d} className="text-xs font-semibold text-slate-400 uppercase py-1">{d}</div>)}
                                </div>
                                <div className="grid grid-cols-7 gap-1 mb-6">
                                    {Array.from({ length: getFirstDayOfMonth(pickerDate.getFullYear(), pickerDate.getMonth()) }).map((_, i) => (
                                        <div key={`empty - ${i} `} className="h-9"></div>
                                    ))}
                                    {Array.from({ length: getDaysInMonth(pickerDate.getFullYear(), pickerDate.getMonth()) }).map((_, i) => {
                                        const day = i + 1;
                                        const isSelected = tempSelectedDate && tempSelectedDate.getDate() === day && tempSelectedDate.getMonth() === pickerDate.getMonth() && tempSelectedDate.getFullYear() === pickerDate.getFullYear();
                                        const isDisabled = isDateDisabled(day);
                                        return (
                                            <button type="button" key={day} onClick={() => handleDateClick(day)} disabled={isDisabled}
                                                className={`h-9 w-9 rounded-full text-sm font-medium flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md' : isDisabled ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-slate-700 hover:bg-slate-100'} `}>
                                                {day}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Time */}
                                <div className="bg-slate-50 p-3 rounded-xl mb-6 border border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Heure de début</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                                        <select value={tempTime} onChange={(e) => setTempTime(e.target.value)}
                                            className="w-full pl-9 pr-10 py-2 h-12 bg-white border border-slate-200 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 text-lg cursor-pointer">
                                            <option value="" disabled>--:--</option>
                                            {TIME_SLOTS.map(t => <option key={t} value={t} disabled={isTimeDisabled(t)}>{t}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setShowCalendar(false)} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition">Annuler</button>
                                    <button type="button" onClick={confirmDateTime} disabled={!tempTime} className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition ${!tempTime ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700'} `}>Valider</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- PRODUCTS SECTION --- */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Droplet className="text-white w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Produits Sanguins (Transfusions)</h2>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Multi-select Grid */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-3">Type de produit sanguin</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {TRANSFUSION_PRODUCT_OPTS.map(prod => {
                                    const isSelected = !!selectedProductsQty[prod.id];
                                    return (
                                        <div key={prod.id}
                                            onClick={() => handleToggleProduct(prod.id)}
                                            className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 p-4 flex flex-col items-center gap-3 group
                                                ${isSelected
                                                    ? `${prod.activeBorder} ${prod.activeBg} shadow-md`
                                                    : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                                                } `}
                                        >
                                            {/* Dot badge */}
                                            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full transition-all ${isSelected ? `${prod.activeDot} scale-100` : 'bg-slate-200 scale-0'} `}></div>

                                            <div className={`${prod.color} `}>
                                                <prod.icon className="w-6 h-6" fill={isSelected ? "currentColor" : "none"} />
                                            </div>
                                            <span className={`font-bold text-sm text-center ${isSelected ? prod.activeText : 'text-slate-600'} `}>{prod.label}</span>

                                            {/* Validation helper */}
                                            {isSubmitted && !isSelected && Object.keys(selectedProductsQty).length === 0 && (
                                                <div className="absolute inset-0 rounded-xl border-2 border-red-500 opacity-20 pointer-events-none"></div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Dynamic Input Fields for Selected Products */}
                        {Object.keys(selectedProductsQty).length > 0 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantités (Nombre de poches)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(selectedProductsQty).map(([pid, qty]) => {
                                        const prod = TRANSFUSION_PRODUCT_OPTS.find(p => p.id === pid)!;
                                        return (
                                            <div key={pid} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg ${prod.activeBg} `}>
                                                        <prod.icon className={`w-4 h-4 ${prod.color} `} />
                                                    </div>
                                                    <span className="font-semibold text-slate-700">{prod.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={qty}
                                                        onChange={(e) => handleProductQtyChange(pid, e.target.value)}
                                                        className="w-20 py-1.5 px-2 text-center font-bold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                                    />
                                                    <span className="text-sm text-slate-500">poche(s)</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Transfusion Duration */}
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Durée de transfusion <span className="text-red-500">*</span></label>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="00"
                                            value={parseDuration(transfusionDuration).h.toString()}
                                            onChange={(e) => handleManualTimeChange('hours', e.target.value, 'duration')}
                                            className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none focus:border-indigo-500 ${validationState.errorsByField.transfusionDuration ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'} `}
                                        />
                                    </div>
                                    <span className="font-bold text-slate-400">:</span>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            placeholder="00"
                                            value={parseDuration(transfusionDuration).m.toString()}
                                            onChange={(e) => handleManualTimeChange('minutes', e.target.value, 'duration')}
                                            className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none focus:border-indigo-500 ${validationState.errorsByField.transfusionDuration ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'} `}
                                        />
                                    </div>
                                    <span className="text-sm text-slate-500 ml-2">(Heures : Minutes)</span>
                                </div>
                                {validationState.errorsByField.overlap && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-xs font-semibold text-red-700">{OVERLAP_ERROR_MSG}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Comments */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                Instructions (Groupage, RAI, etc.)
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Ajouter des précisions..."
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-medium text-slate-800"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* --- CALENDAR SECTION (BLUE) --- */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-indigo-600 px-6 py-4 flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Clock className="text-white w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Calendrier d'Administration</h2>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Type Toggle */}
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button type="button" onClick={() => handleTypeChange('frequency')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${prescriptionType === 'frequency' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'} `}>
                                <Activity className="w-4 h-4" /> Fréquence
                            </button>
                            <button type="button" onClick={() => handleTypeChange('punctual-frequency')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${prescriptionType === 'punctual-frequency' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'} `}>
                                <div className="flex items-center gap-1"><Zap className="w-4 h-4 fill-current" /><span>Ponct + Freq</span></div>
                            </button>
                            <button type="button" onClick={() => handleTypeChange('one-time')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${prescriptionType === 'one-time' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'} `}>
                                <Syringe className="w-4 h-4" /> Ponctuel
                            </button>
                        </div>

                        {/* Schedule Body */}
                        <div className="min-h-[160px]">
                            {/* Punctual Only Info */}
                            {prescriptionType === 'one-time' && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3 animate-in fade-in">
                                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-800">Mode Ponctuel</h4>
                                        <p className="text-xs text-amber-700 mt-1">Cette transfusion sera administrée une seule fois à la date et l'heure indiquées.</p>
                                    </div>
                                </div>
                            )}

                            {(prescriptionType === 'frequency' || prescriptionType === 'punctual-frequency') && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    {/* Daily Mode */}
                                    <div className="flex gap-6">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scheduleData.dailySchedule === 'everyday' ? 'border-indigo-600' : 'border-slate-300'} `}>
                                                {scheduleData.dailySchedule === 'everyday' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                                            </div>
                                            <span className={`text-sm font-medium ${scheduleData.dailySchedule === 'everyday' ? 'text-indigo-900' : 'text-slate-600'} `}>Tous les jours</span>
                                            <input type="radio" className="hidden" checked={scheduleData.dailySchedule === 'everyday'} onChange={() => handleDailyScheduleChange('everyday')} />
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scheduleData.dailySchedule === 'every-other-day' ? 'border-indigo-600' : 'border-slate-300'} `}>
                                                {scheduleData.dailySchedule === 'every-other-day' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                                            </div>
                                            <span className={`text-sm font-medium ${scheduleData.dailySchedule === 'every-other-day' ? 'text-indigo-900' : 'text-slate-600'} `}>1 jour / 2</span>
                                            <input type="radio" className="hidden" checked={scheduleData.dailySchedule === 'every-other-day'} onChange={() => handleDailyScheduleChange('every-other-day')} />
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scheduleData.dailySchedule === 'specific-days' ? 'border-indigo-600' : 'border-slate-300'} `}>
                                                {scheduleData.dailySchedule === 'specific-days' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                                            </div>
                                            <span className={`text-sm font-medium ${scheduleData.dailySchedule === 'specific-days' ? 'text-indigo-900' : 'text-slate-600'} `}>Jours spécifiques</span>
                                            <input type="radio" className="hidden" checked={scheduleData.dailySchedule === 'specific-days'} onChange={() => handleDailyScheduleChange('specific-days')} />
                                        </label>
                                    </div>
                                    {/* Specific Days */}
                                    {scheduleData.dailySchedule === 'specific-days' && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <div className="flex gap-2 w-full">
                                                {DAYS.map(day => {
                                                    const isSelected = scheduleData.selectedDays.includes(day);
                                                    return (
                                                        <button
                                                            key={day}
                                                            type="button"
                                                            onClick={() => toggleDay(day)}
                                                            className={`
        flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-lg border-2 transition-all active: scale-95
                                                                ${isSelected
                                                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-inner'
                                                                    : 'border-indigo-100 bg-white text-indigo-300 hover:border-indigo-300'
                                                                }
        `}
                                                        >
                                                            {day}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Frequency Details */}
                                    <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100/50">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-xs font-bold text-indigo-900 uppercase tracking-widest">Mode de Fréquence</span>
                                            <div className="flex bg-white rounded-lg border border-indigo-100 p-1 shadow-sm">
                                                {['cycle', 'specific-time', 'simple'].map((m) => {
                                                    const isDisabled = m === 'cycle' && (scheduleData.dailySchedule === 'every-other-day' || scheduleData.dailySchedule === 'specific-days');
                                                    return (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            onClick={() => !isDisabled && updateSchedule('mode', m)}
                                                            disabled={isDisabled}
                                                            className={`px-3 py-2 text-sm font-semibold rounded-md transition-all ${scheduleData.mode === m
                                                                ? 'bg-indigo-100 text-indigo-700'
                                                                : isDisabled
                                                                    ? 'opacity-40 cursor-not-allowed text-slate-300'
                                                                    : 'text-slate-500 hover:text-slate-700'
                                                                } `}
                                                        >
                                                            {m === 'simple' ? 'Simple' : m === 'cycle' ? 'Cyclique' : 'Heure Fixe'}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* CYCLE */}
                                        {scheduleData.mode === 'cycle' && (
                                            <div className="animate-in fade-in">
                                                <label className="block text-sm font-medium text-indigo-900 mb-2">Répéter toutes les :</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['2', '4', '6', '8', '12', '24'].map(hr => (
                                                        <button key={hr} type="button" onClick={() => handleIntervalSelect(hr)}
                                                            className={`flex-1 min-w-[60px] py-2 text-sm font-medium border rounded-lg transition-all ${!scheduleData.isCustomInterval && scheduleData.interval === hr ? 'bg-indigo-600 text-white border-indigo-600' : `bg-white text-slate-600 border-indigo-200 hover:bg-indigo-50 ${validationState.errorsByField.cycle ? 'border-red-500 ring-1 ring-red-500' : ''}`} `}>{hr}h</button>
                                                    ))}
                                                    <button type="button" onClick={handleCustomInterval} className={`px-4 py-2 text-sm font-medium border rounded-lg transition-all ${scheduleData.isCustomInterval ? 'bg-indigo-600 text-white border-indigo-600' : `bg-white text-slate-600 border-indigo-200 hover:bg-indigo-50 ${validationState.errorsByField.cycle ? 'border-red-500 ring-1 ring-red-500' : ''}`} `}>Autre</button>
                                                </div>
                                                {scheduleData.isCustomInterval && (
                                                    <div className="mt-3 flex items-center gap-2 animate-in fade-in">
                                                        <input type="number" value={scheduleData.interval} onChange={(e) => updateSchedule('interval', e.target.value)} className={`w-24 p-2 text-sm text-center font-bold text-indigo-800 bg-white border rounded-lg outline-none ${validationState.errorsByField.cycle ? 'border-red-500 ring-1 ring-red-500' : 'border-indigo-300'} `} autoFocus />
                                                        <span className="text-sm font-medium text-indigo-800">heures</span>
                                                    </div>
                                                )}
                                                {validationState.errorsByField.cycle && (
                                                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                                        <span className="text-xs font-semibold text-red-700">{CYCLIC_ADMIN_INTERVAL_ERROR}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* SIMPLE */}
                                        {scheduleData.mode === 'simple' && (
                                            <div className="animate-in fade-in">
                                                <label className="block text-sm font-medium text-indigo-900 mb-2">Fréquence :</label>
                                                <div className="flex items-center gap-3">
                                                    <input type="number" min="1" value={scheduleData.simpleCount} onChange={(e) => updateSchedule('simpleCount', e.target.value)} className={`w-20 p-2 text-center text-sm font-bold text-indigo-800 bg-white border rounded-lg outline-none ${validationState.errorsByField.simpleCount ? 'border-red-500 ring-1 ring-red-500' : 'border-indigo-300'} `} />
                                                    <span className="text-sm font-semibold text-indigo-700">fois par jours</span>
                                                    <div className="flex items-center gap-1.5 ml-4">
                                                        <label className="block text-xs font-semibold text-slate-500">Durée inter-prises:</label>
                                                        <div className="flex items-center gap-2">
                                                            <input type="number" min="0" placeholder="00" value={parseDuration(scheduleData.intervalDuration || '00:00').h} onChange={(e) => handleManualTimeChange('hours', e.target.value, 'interval')} disabled={parseInt(scheduleData.simpleCount || '0') <= 1} className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border rounded-lg outline-none ${parseInt(scheduleData.simpleCount || '0') <= 1 ? 'opacity-50 cursor-not-allowed' : ''} ${validationState.errorsByField.interval ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'} `} />
                                                            <span className="font-bold text-slate-400">:</span>
                                                            <input type="number" min="0" max="59" placeholder="00" value={parseDuration(scheduleData.intervalDuration || '00:00').m} onChange={(e) => handleManualTimeChange('minutes', e.target.value, 'interval')} disabled={parseInt(scheduleData.simpleCount || '0') <= 1} className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border rounded-lg outline-none ${parseInt(scheduleData.simpleCount || '0') <= 1 ? 'opacity-50 cursor-not-allowed' : ''} ${validationState.errorsByField.interval ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'} `} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* SPECIFIC TIME */}
                                        {scheduleData.mode === 'specific-time' && (
                                            <div className="animate-in fade-in space-y-4">
                                                <div className="flex gap-3">
                                                    {STANDARD_TIMES.map(({ label, time, icon: Icon }) => {
                                                        const isSelected = scheduleData.specificTimes.includes(time);
                                                        return (
                                                            <button key={label} type="button" onClick={() => toggleSpecificTime(time)} className={`flex-1 py-2.5 px-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-indigo-100 text-slate-600 hover:bg-indigo-50'} `}>
                                                                <div className="flex items-center gap-1.5"><Icon className="w-4 h-4" /><span className="font-bold text-sm">{label}</span></div>
                                                                <span className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-slate-400'} `}>{time}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wide mb-2">Ajouter une heure personnalisée</label>
                                                    <div className="relative">
                                                        <select onChange={addCustomTime} value="" className="w-full pl-3 pr-10 py-2.5 h-12 bg-white border border-indigo-200 rounded-xl appearance-none outline-none text-sm font-medium text-slate-700">
                                                            <option value="" disabled>Sélectionner...</option>
                                                            {HOURS_24.map(h => <option key={h} value={h} disabled={scheduleData.specificTimes.includes(h)}>{h}</option>)}
                                                        </select>
                                                        <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {/* Chips */}
                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    {scheduleData.specificTimes.sort().map(time => (
                                                        <div key={time} className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white border border-indigo-100 rounded-full shadow-sm text-indigo-700 text-sm font-bold animate-in zoom-in-95">
                                                            <span>{time}</span>
                                                            <button type="button" onClick={() => toggleSpecificTime(time)} className="p-1 rounded-full hover:bg-red-50 text-indigo-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 border-t border-slate-100 pt-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date de Début <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input type="datetime-local" min={getMinDateTimeForInput()} className={`w-full pl-3 pr-10 py-2.5 h-12 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 bg-slate-50 [&::-webkit-calendar-picker-indicator]:hidden ${validationState.alerte.message.includes(OVERLAP_ERROR_MSG) ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'} `}
                                            value={scheduleData.startDateTime} onChange={(e) => updateSchedule('startDateTime', e.target.value)}
                                        />
                                        <button type="button" onClick={openCalendarModal} className="absolute right-1 top-1 bottom-1 aspect-square bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm z-10"><Calendar className="w-5 h-5" /></button>
                                    </div>
                                </div>
                                {['frequency', 'punctual-frequency'].includes(prescriptionType) && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Durée de Traitement <span className="text-red-500">*</span></label>
                                        <div className={`flex shadow-sm rounded-xl overflow-hidden border h-12 ${validationState.errorsByField.duration ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'} `}>
                                            <input type="number" min="1" placeholder="--" className="flex-1 text-center bg-white outline-none text-sm font-medium h-full p-2"
                                                value={scheduleData.durationValue === '--' ? '' : scheduleData.durationValue} onChange={(e) => updateSchedule('durationValue', e.target.value || '--')}
                                            />
                                            <div className="w-px bg-slate-200"></div>
                                            <button type="button" onClick={() => updateSchedule('durationUnit', scheduleData.durationUnit === 'days' ? 'weeks' : 'days')} className="w-1/2 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-600 transition">
                                                {scheduleData.durationUnit === 'days' ? 'Jours' : 'Semaines'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {validationState.errorsByField.overlap && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs font-semibold text-red-700">{OVERLAP_ERROR_MSG}</span>
                                </div>
                            )}

                            {/* --- SCHEDULE DETAILS (EMBEDDED) --- */}
                            {['frequency', 'punctual-frequency'].includes(prescriptionType) && (
                                <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center gap-2 mb-4 p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl">
                                        <Clock className="w-5 h-5 text-indigo-600" />
                                        <h3 className="font-bold text-indigo-900 text-sm">Détail des horaires calculés</h3>
                                    </div>

                                    {/* Summaries Block */}
                                    <div className="mb-4 space-y-2">
                                        {modifiedDosesSummary}
                                        {skippedDosesSummary}
                                    </div>


                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        {doseScheduleCards.needsDetail ? (
                                            <div className="space-y-3">
                                                {doseScheduleCards.message && (
                                                    <div className="flex items-start gap-3 p-3 rounded-lg text-slate-500 bg-white border border-slate-100 mb-4 shadow-sm">
                                                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-slate-400" />
                                                        <span className="text-sm">{doseScheduleCards.message}</span>
                                                    </div>
                                                )}

                                                {finalDoses.map((dose: any, idx: number) => {
                                                    const isSkipped = skippedDoseIds.has(dose.id);

                                                    // Editability Logic & Bounds Calculation for Transfusion
                                                    // Transfusion has DURATION.
                                                    // Prev Dose End = prev.date + duration
                                                    // Next Dose Start = next.date
                                                    const isFirst = idx === 0;
                                                    const isLast = idx === finalDoses.length - 1;
                                                    const isPunctualMode = prescriptionType === 'punctual-frequency';
                                                    const isSecondInPunctual = isPunctualMode && idx === 1; // "First programmed"
                                                    const isEditable = !isFirst && !isLast && !isSecondInPunctual && !isSkipped;

                                                    const isEditing = editingDoseId === dose.id;
                                                    const isModified = manualDoseAdjustments.has(dose.id);
                                                    const isImmediate = isPunctualMode && idx === 0;

                                                    const showDateHeader = idx === 0 || finalDoses[idx - 1].date.getDate() !== dose.date.getDate();

                                                    return (
                                                        <div key={dose.id}>
                                                            {showDateHeader && (
                                                                <div className="flex items-center gap-4 py-4">
                                                                    <div className="h-px flex-1 bg-slate-200"></div>
                                                                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
                                                                        <Calendar className="w-4 h-4" />
                                                                        <span className="capitalize">
                                                                            {dose.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-px flex-1 bg-slate-200"></div>
                                                                </div>
                                                            )}

                                                            {isEditing && !isSkipped ? (
                                                                <DoseEditor
                                                                    dose={dose}
                                                                    // Prev Dose End: If first, fallback to -24h. Else use prev dose date + transfusion duration.
                                                                    prevDoseEnd={idx > 0
                                                                        ? new Date(finalDoses[idx - 1].date.getTime() + durationToDecimal(transfusionDuration) * 60 * 60 * 1000)
                                                                        : new Date(dose.date.getTime() - 24 * 60 * 60 * 1000)}
                                                                    // Next Dose Start: If last, fallback to +24h. Else use next dose date.
                                                                    nextDoseStart={idx < finalDoses.length - 1
                                                                        ? finalDoses[idx + 1].date
                                                                        : new Date(dose.date.getTime() + 24 * 60 * 60 * 1000)}
                                                                    onSave={(valStr) => handleSaveEdit(dose.id, new Date(valStr))}
                                                                    onCancel={() => setEditingDoseId(null)}
                                                                    adminMode="continuous"
                                                                    adminDuration={transfusionDuration}
                                                                />
                                                            ) : (
                                                                <div className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${isSkipped
                                                                    ? 'bg-slate-50 border-slate-200 opacity-75'
                                                                    : isModified
                                                                        ? 'bg-amber-50 border-amber-200 shadow-sm'
                                                                        : 'bg-white border-slate-200 hover:border-indigo-200'
                                                                    }`}>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className={`p-2.5 rounded-full ${isSkipped
                                                                            ? 'bg-slate-100 text-slate-400'
                                                                            : isImmediate
                                                                                ? 'bg-amber-100 text-amber-600'
                                                                                : isModified
                                                                                    ? 'bg-amber-100 text-amber-600'
                                                                                    : 'bg-indigo-50 text-indigo-600'
                                                                            }`}>
                                                                            {isSkipped ? <CalendarOff size={18} /> : isImmediate ? <Zap size={18} /> : <Clock size={18} />}
                                                                        </div>

                                                                        <div className="flex flex-col">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    {isModified && !isSkipped ? (
                                                                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                                                                            <span className="text-xs font-medium text-slate-400 line-through decoration-slate-300">
                                                                                                {dose.originalDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) === dose.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                                                                                                    ? dose.originalTime
                                                                                                    : `${dose.originalDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${dose.originalTime}`
                                                                                                }
                                                                                            </span>
                                                                                            <ArrowRight size={14} className="text-amber-400" />
                                                                                            <span className="text-lg font-bold text-slate-700 font-mono tracking-tight">
                                                                                                {dose.originalDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) === dose.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                                                                                                    ? dose.time
                                                                                                    : `${dose.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${dose.time}`
                                                                                                }
                                                                                            </span>
                                                                                            <span className="bg-amber-100 text-amber-700 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full tracking-wide">
                                                                                                Modifié
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className={`text-lg font-bold font-mono tracking-tight ${isSkipped ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-700'}`}>
                                                                                            {dose.time}
                                                                                        </span>
                                                                                    )}
                                                                                    {isImmediate && (
                                                                                        <span className="bg-amber-100 text-amber-700 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full tracking-wide">Maintenant</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-xs font-medium text-slate-400 capitalize">
                                                                                {isSkipped ? 'Transfusion annulée' :
                                                                                    isImmediate ? 'Transfusion immédiate' :
                                                                                        isModified ? 'Horaire personnalisé' :
                                                                                            'Horaire standard'}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        {!isSkipped && !isImmediate && (
                                                                            <>
                                                                                {isModified && (
                                                                                    <button
                                                                                        onClick={() => handleResetDose(dose.id)}
                                                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                                        title="Rétablir l'horaire initial"
                                                                                    >
                                                                                        <RotateCcw size={16} />
                                                                                    </button>
                                                                                )}
                                                                                {isEditable && (
                                                                                    <button
                                                                                        onClick={() => setEditingDoseId(dose.id)}
                                                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                                        title="Modifier l'horaire"
                                                                                    >
                                                                                        <Edit2 size={16} />
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleToggleDoseSkipped(dose.id)}
                                                                            disabled={isImmediate}
                                                                            className={`p-2 rounded-lg transition-colors ${isImmediate ? 'opacity-50 cursor-not-allowed hidden' : ''
                                                                                } ${isSkipped
                                                                                    ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                                                                                    : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                                                                }`}
                                                                            title={isSkipped ? "Rétablir la transfusion" : "Annuler cette transfusion"}
                                                                        >
                                                                            {isSkipped ? <Undo2 size={16} /> : <Trash2 size={16} />}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                                <Clock className="w-8 h-8 mb-2 text-slate-300" />
                                                <p className="text-sm font-medium">{doseScheduleCards.message || "Configurez la fréquence ci-dessus."}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: PREVIEW & ACTION */}
            <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Aperçu de l'ordonnance</h3>

                    <div className={`rounded-xl border-2 border-dashed p-6 transition-all duration-300 ${!Object.keys(selectedProductsQty).length ? 'border-red-200 bg-red-50/10' : (isSubmitted && validationState.isValid ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-slate-50')} `}>
                        {Object.keys(selectedProductsQty).length === 0 ? (
                            <div className="flex flex-col items-center text-center text-slate-400 py-8 animate-in fade-in">
                                <Activity className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-medium opacity-60">Remplissez le formulaire pour voir l'aperçu</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {previewListFormDatas.map((fd, idx) => (
                                    <PrescriptionCard key={idx} formData={fd} />
                                ))}

                                {/* Grouped warning at the bottom, matching medication form style */}
                                {modifiedDosesSummary}
                                {skippedDosesSummary}
                            </div>
                        )}
                    </div>

                    {/* Product selection error message for transfusion */}
                    {Object.keys(selectedProductsQty).length === 0 && (
                        <div className="mt-4 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600" />
                            <span className="font-semibold">Veuillez séléctionner au moins un type de produit sanguin à transfuser.</span>
                        </div>
                    )}

                    {/* Validation Errors / Status */}
                    {!validationState.isValid && (
                        <div className="mt-4 p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-100">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <span className="font-bold uppercase tracking-wider">Erreurs de validation</span>
                            </div>
                            <ul className="space-y-1.5 list-disc pl-4">
                                {validationState.errors.map((err, i) => (
                                    <li key={i} className="font-medium">{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-6 space-y-3">
                        <button
                            type="button"
                            onClick={handleValidate}
                            disabled={!validationState.isValid}
                            className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-all active: scale-[0.98] flex justify-center items-center gap-2 
                                ${!validationState.isValid
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                    : 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
                                } `}
                        >
                            <CheckCircle className="w-5 h-5" />
                            {isSubmitted && validationState.isValid ? 'Mettre à jour' : "Valider l'Ordonnance"}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSelectedProductsQty({}); setComment(''); setTransfusionDuration('02:00'); setIsSubmitted(false); }}
                            className="w-full bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 font-semibold py-2.5 rounded-xl border border-slate-200 hover:border-red-200 transition-colors flex justify-center items-center gap-2 text-sm"
                        >
                            <X className="w-4 h-4" />
                            Effacer
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};



export default TransfusionPrescriptionForm;
