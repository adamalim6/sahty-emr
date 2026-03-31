import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    Scan, Search, X, CheckCircle, FileText,
    Clock, Calendar, Activity, Zap, Syringe, ChevronLeft, ChevronRight, ChevronDown, AlertCircle,
    Sun, SunMedium, Moon, BedDouble, Plus,
    Edit2, Trash2, RotateCcw, Undo2, Save, ArrowRight, CalendarOff
} from 'lucide-react';
import { FormData, ScheduleData, PrescriptionType, DoseScheduleResult } from './types';
import { PrescriptionCard } from './PrescriptionCard';
import { api } from '../../services/api';
import { durationToDecimal, formatDuration, generateDoseSchedule } from './utils';
import { DoseEditor } from './DoseEditor';

interface Dose {
    id: string;
    date: Date;
    time: string;
    originalDate?: Date;
    skipped?: boolean;
}

// Constants

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const TIME_SLOTS = Array.from({ length: 48 }).map((_, i) => {
    const h = Math.floor(i / 2);
    const m = i % 2 === 0 ? '00' : '30';
    return `${String(h).padStart(2, '0')}:${m}`;
});

const HOURS_24 = Array.from({ length: 24 }).map((_, i) => `${String(i).padStart(2, '0')}:00`);

const STANDARD_TIMES = [
    { label: 'Matin', time: '08:00', icon: Sun },
    { label: 'Midi', time: '12:00', icon: SunMedium },
    { label: 'Soir', time: '18:00', icon: Moon },
    { label: 'Coucher', time: '22:00', icon: BedDouble },
];

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
    return getCurrentDateTime();
};

const parseDuration = (durationStr: string) => {
    if (!durationStr || durationStr === '00:00') return { h: 0, m: 0 };
    const [h, m] = durationStr.split(':').map(Number);
    return { h: h || 0, m: m || 0 };
};


interface ImageryPrescriptionFormProps {
    onSave?: (data: FormData[]) => void;
}

export const ImageryPrescriptionForm: React.FC<ImageryPrescriptionFormProps> = ({ onSave }) => {
    // --- STATE ---
    const [selectedExams, setSelectedExams] = useState<{ id: string, label: string }[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchResults, setSearchResults] = useState<{ id: string, label: string }[]>([]);
    const [isLoadingSearchResults, setIsLoadingSearchResults] = useState(false);
    const [comment, setComment] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

    // Schedule State (Mirroring PrescriptionForm)
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

    // Default to one-time (Ponctuel)
    const [prescriptionType, setPrescriptionType] = useState<PrescriptionType>('one-time');

    // Dose Management State
    const [manuallyAdjustedEvents, setManuallyAdjustedEvents] = useState<Map<string, string>>(new Map());
    const [editingDoseId, setEditingDoseId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [skippedEvents, setSkippedEvents] = useState<string[]>([]);

    useEffect(() => {
        if (manuallyAdjustedEvents.size > 0) {
            setManuallyAdjustedEvents(new Map());
            setToastMessage("Le calendrier a changé, les modifications manuelles ont été réinitialisées.");
            setTimeout(() => setToastMessage(null), 3000);
        }
    }, [scheduleData, prescriptionType]);

    // --- DOSE LOGIC ---

    const getDoseScheduleCards = useMemo((): DoseScheduleResult => {
        return generateDoseSchedule(
            scheduleData,
            'imagery',
            prescriptionType,
            'instant',
            '00:00'
        );
    }, [scheduleData, prescriptionType]);

    const finalDoses = useMemo(() => {
        if (!getDoseScheduleCards.cards) return [];
        return getDoseScheduleCards.cards.map(dose => {
            const adjustedTime = manuallyAdjustedEvents.get(dose.id);
            const originalDate = dose.date;
            const originalTime = dose.time;
            const isSkipped = skippedEvents.includes(dose.id);

            if (adjustedTime) {
                const newDate = new Date(adjustedTime);
                return {
                    id: dose.id,
                    date: newDate,
                    time: newDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    originalDate,
                    originalTime,
                    isModified: true,
                    skipped: isSkipped
                };
            }
            return {
                id: dose.id,
                date: originalDate,
                time: originalTime,
                originalDate,
                originalTime,
                isModified: false,
                skipped: isSkipped
            };
        });
    }, [getDoseScheduleCards, manuallyAdjustedEvents, skippedEvents]);

    const modifiedEventsSummary = useMemo(() => {
        if (manuallyAdjustedEvents.size === 0) return null;
        const count = manuallyAdjustedEvents.size;
        return `${count} horaire${count > 1 ? 's' : ''} modifié${count > 1 ? 's' : ''} manuellement`;
    }, [manuallyAdjustedEvents]);

    const skippedEventsSummary = useMemo(() => {
        if (skippedEvents.length === 0) return null;
        const count = skippedEvents.length;
        return `${count} prise${count > 1 ? 's' : ''} ignorée${count > 1 ? 's' : ''}`;
    }, [skippedEvents]);

    const handleEditDose = (doseId: string) => {
        setEditingDoseId(doseId);
    };

    const handleSaveDose = (newTimeIso: string) => {
        if (editingDoseId) {
            setManuallyAdjustedEvents(prev => {
                const next = new Map(prev);
                next.set(editingDoseId, newTimeIso);
                return next;
            });
            setEditingDoseId(null);
        }
    };

    const handleCancelEdit = () => {
        setEditingDoseId(null);
    };

    const handleResetDose = (doseId: string) => {
        setManuallyAdjustedEvents(prev => {
            const next = new Map(prev);
            next.delete(doseId);
            return next;
        });
    };

    const handleToggleDoseSkipped = (doseId: string) => {
        setSkippedEvents(prev => {
            if (prev.includes(doseId)) return prev.filter(id => id !== doseId);
            return [...prev, doseId];
        });
    };

    // Calendar Modal State
    const [showCalendar, setShowCalendar] = useState(false);
    const [pickerDate, setPickerDate] = useState(new Date());
    const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(null);
    const [tempTime, setTempTime] = useState("");

    useEffect(() => {
        if (!searchTerm) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsLoadingSearchResults(true);
            try {
                const res = await api.getTenantActes({ family: 'Imagerie', search: searchTerm, limit: 20 });
                setSearchResults(res.data);
            } catch (err) {
                console.error("Error fetching imagery actes", err);
            } finally {
                setIsLoadingSearchResults(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const filteredExams = searchResults.filter(exam =>
        !selectedExams.some(e => e.id === exam.id)
    );

    const isSpecificTimeRestricted = prescriptionType === 'punctual-frequency' && scheduleData.mode === 'specific-time' && scheduleData.specificTimes.length > 0;


    // --- HANDLERS ---

    const handleToggleExam = (exam: { id: string, label: string }) => {
        if (selectedExams.some(e => e.id === exam.id)) {
            setSelectedExams(prev => prev.filter(e => e.id !== exam.id));
        } else {
            setSelectedExams(prev => [...prev, exam]);
            setSearchTerm('');
            setShowSuggestions(false);
        }
        setError(null);
    };

    const handleRemoveExam = (examId: string) => {
        setSelectedExams(prev => prev.filter(e => e.id !== examId));
    };

    // Schedule Handlers
    const handleTypeChange = (newType: PrescriptionType) => {
        setPrescriptionType(newType);

        if (newType === 'punctual-frequency') {
            setScheduleData(prev => ({ ...prev, startDateTime: "" }));
        } else if (newType === 'frequency' && (!scheduleData.startDateTime || prescriptionType === 'punctual-frequency')) {
            if (!scheduleData.startDateTime) {
                setScheduleData(prev => ({ ...prev, startDateTime: getCurrentDateTime() }));
            }
        } else if (newType === 'one-time') {
            if (!scheduleData.startDateTime) {
                setScheduleData(prev => ({ ...prev, startDateTime: getCurrentDateTime() }));
            }
        }
    };

    const updateSchedule = (field: keyof ScheduleData, value: any) => {
        setScheduleData(prev => {
            const newSchedule = { ...prev, [field]: value };
            if (field === 'mode' && value === 'specific-time' && prescriptionType === 'punctual-frequency') {
                newSchedule.startDateTime = "";
            }
            return newSchedule;
        });
    };

    const handleDailyScheduleChange = (value: 'everyday' | 'every-other-day' | 'specific-days') => {
        let newScheduleMode = scheduleData.mode;
        if ((value === 'every-other-day' || value === 'specific-days') && scheduleData.mode === 'cycle') {
            newScheduleMode = 'simple';
        }
        setScheduleData(prev => ({ ...prev, dailySchedule: value, mode: newScheduleMode }));
    };

    const toggleDay = (day: string) => {
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
        const isRemoving = scheduleData.specificTimes.includes(time);
        const newTimes = isRemoving
            ? scheduleData.specificTimes.filter(t => t !== time)
            : [...scheduleData.specificTimes, time].sort();

        let newStartDateTime = scheduleData.startDateTime;

        if (prescriptionType === 'punctual-frequency' && scheduleData.mode === 'specific-time') {
            if (newStartDateTime) {
                const currentStartTime = newStartDateTime.split('T')[1];
                if (!newTimes.includes(currentStartTime)) {
                    newStartDateTime = "";
                }
            }
        }

        setScheduleData(prev => ({
            ...prev,
            specificTimes: newTimes,
            startDateTime: newStartDateTime
        }));
    };

    const addCustomTime = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTime = e.target.value;
        if (newTime && !scheduleData.specificTimes.includes(newTime)) {
            const newTimes = [...scheduleData.specificTimes, newTime].sort();
            setScheduleData(prev => ({ ...prev, specificTimes: newTimes }));
        }
    };

    const handleManualTimeChange = (type: 'hours' | 'minutes', value: string, targetField: string) => {
        let num = parseInt(value);
        if (isNaN(num)) num = 0;
        if (num < 0) num = 0;
        if (type === 'minutes' && num > 59) num = 59;

        const currentDuration = parseDuration(scheduleData.intervalDuration || "00:00");
        let h = currentDuration.h;
        let m = currentDuration.m;

        if (type === 'hours') h = num;
        else m = num;

        const newDuration = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        updateSchedule('intervalDuration', newDuration);
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

    // --- VALIDATION AND SAVE ---

    // --- VALIDATION AND SAVE ---

    const getValidationState = () => {
        const errorMessages: string[] = [];
        const warningMessages: string[] = [];
        const newFieldErrors: Record<string, boolean> = {};

        // 1. Mandatory Fields
        if (selectedExams.length === 0) {
            errorMessages.push("Veuillez sélectionner au moins un examen.");
            newFieldErrors['exams'] = true;
        }
        if (prescriptionType !== 'punctual-frequency' && !scheduleData.startDateTime) {
            errorMessages.push("Veuillez sélectionner une date de début.");
            newFieldErrors['startDate'] = true;
        }
        // Imagery typically doesn't strictly require duration if punctual-frequency often implies one-shot or limited repetition,
        // but if Frequency is selected, duration IS required.
        if (['frequency', 'punctual-frequency'].includes(prescriptionType)) {
            // We need to check if durationValue is defined and valid. 
            // Note: durationValue defaults to '--'
            const duration = parseFloat(scheduleData.durationValue === '--' ? '0' : scheduleData.durationValue);
            if (!scheduleData.durationValue || scheduleData.durationValue === '--' || isNaN(duration) || duration <= 0) {
                errorMessages.push("Durée de traitement requise.");
                newFieldErrors['duration'] = true;
            }
        }

        // 2. Schedule Logic (Simple Mode) - mirroring Biology
        if (['frequency', 'punctual-frequency'].includes(prescriptionType)) {
            if (scheduleData.mode === 'simple' && ['everyday', 'every-other-day', 'specific-days'].includes(scheduleData.dailySchedule)) {
                const count = parseInt(scheduleData.simpleCount || '0');
                if (count > 1) {
                    // Check if interval is set
                    const intervalStr = scheduleData.intervalDuration;
                    if (!intervalStr || intervalStr === '00:00') {
                        // Warning: No interval set for multiple daily doses
                        warningMessages.push("Cette prescription ne sera pas ajoutée à la fiche de surveillance car la durée inter-prise n'est pas renseignée.");
                        newFieldErrors['interval'] = true;
                    } else {
                        // Error: Check for overlap
                        const { h, m } = parseDuration(intervalStr);
                        const intervalMinutes = h * 60 + m;
                        const totalSpanMinutes = (count - 1) * intervalMinutes;

                        if (scheduleData.startDateTime) {
                            const startDate = new Date(scheduleData.startDateTime);
                            const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();

                            if (startMinutes + totalSpanMinutes >= 24 * 60) {
                                errorMessages.push("Les prises programmées débordent sur le jour suivant (Débordement > 24h). Ajustez l'heure de début ou l'intervalle.");
                                newFieldErrors['startDate'] = true;
                                newFieldErrors['interval'] = true;
                            }
                        }
                    }
                }
            } else if (scheduleData.mode === 'cycle') {
                if (!scheduleData.interval || scheduleData.interval === '0') {
                    errorMessages.push("Veuillez définir l'intervalle de répétition (toutes les X heures).");
                    newFieldErrors['cycleInterval'] = true;
                }
            } else if (scheduleData.mode === 'specific-time') {
                if (!scheduleData.specificTimes || scheduleData.specificTimes.length === 0) {
                    errorMessages.push("Veuillez sélectionner au moins une heure de prise fixe.");
                    newFieldErrors['specificTimes'] = true;
                }
            }
        }

        return {
            isValid: errorMessages.length === 0,
            errors: errorMessages,
            warnings: warningMessages,
            fieldErrors: newFieldErrors
        };
    };

    const handleValidate = () => {
        const { isValid, errors, warnings, fieldErrors: newFieldErrors } = getValidationState();

        setError(null);
        setWarning(null);
        setFieldErrors(newFieldErrors);

        if (!isValid) {
            setError(errors.join(" "));
            if (warnings.length > 0) setWarning(warnings.join(" "));
            return;
        }

        const manualAdjustmentsRecord = Object.fromEntries(manuallyAdjustedEvents);

        const prescriptions: FormData[] = selectedExams.map(exam => {
            const payload: FormData = {
                molecule: exam.label, // Fallback string representation
                commercialName: exam.label,
                acte_id: exam.id, // NEW: Include the UUID representation
                libelle_sih: exam.label, // NEW: Target taxonomy name
                prescriptionType: 'imagery' as const,
                qty: '--',
                unit: '',
                route: '',
                adminMode: 'instant' as const,
                adminDuration: '00:00',
                schedule_type: prescriptionType,
                dilutionRequired: false,
                solvent: undefined,
                databaseMode: 'hospital' as const,
                substitutable: false,
                skippedEvents: skippedEvents,
                manuallyAdjustedEvents: manualAdjustmentsRecord,
                conditionComment: comment,
                schedule: { ...scheduleData }
            };

            const isNonTemporal = ["biology", "imagery"].includes(payload.prescriptionType);
            if (isNonTemporal && payload.schedule) {
                delete payload.schedule.durationValue;
            }

            return payload;
        });

        if (onSave) {
            onSave(prescriptions);
        }
    };

    const previewData: FormData = {
        molecule: selectedExams.length > 0 ? selectedExams.map(e => e.label).join(', ') : "Aucun examen sélectionné",
        commercialName: "",
        prescriptionType: 'imagery' as const,
        qty: "--", unit: "", route: "",
        adminMode: 'instant' as const,
        adminDuration: "",
        schedule_type: prescriptionType,
        dilutionRequired: false,
        substitutable: false,
        solvent: undefined,
        databaseMode: 'hospital',
        schedule: scheduleData,
        skippedEvents: skippedEvents,
        manuallyAdjustedEvents: Object.fromEntries(manuallyAdjustedEvents),
        conditionComment: comment
    };

    return (
        <div className="flex flex-col gap-6 relative">
            {/* CALENDAR MODAL */}
            {showCalendar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-semibold text-lg">Sélectionner la date</h3>
                            <button type="button" onClick={() => setShowCalendar(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5">
                            <div className="flex justify-between items-center mb-4">
                                <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
                                <span className="font-bold text-slate-800 text-lg capitalize">{MONTHS_FR[pickerDate.getMonth()]} {pickerDate.getFullYear()}</span>
                                <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronRight className="w-5 h-5" /></button>
                            </div>
                            <div className="grid grid-cols-7 mb-2 text-center">
                                {DAYS.map(d => <div key={d} className="text-xs font-semibold text-slate-400 uppercase py-1">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-6">
                                {Array.from({ length: getFirstDayOfMonth(pickerDate.getFullYear(), pickerDate.getMonth()) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="h-9"></div>
                                ))}
                                {Array.from({ length: getDaysInMonth(pickerDate.getFullYear(), pickerDate.getMonth()) }).map((_, i) => {
                                    const day = i + 1;
                                    const isSelected = tempSelectedDate && tempSelectedDate.getDate() === day && tempSelectedDate.getMonth() === pickerDate.getMonth() && tempSelectedDate.getFullYear() === pickerDate.getFullYear();
                                    const isDisabled = isDateDisabled(day);
                                    return (
                                        <button type="button" key={day} onClick={() => handleDateClick(day)} disabled={isDisabled}
                                            className={`h-9 w-9 rounded-full text-sm font-medium flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md' : isDisabled ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-slate-700 hover:bg-slate-100'}`}>
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
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
                                <button type="button" onClick={confirmDateTime} disabled={!tempTime} className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition ${!tempTime ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Valider</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* LEFT COLUMN: FORM */}
            <div className="space-y-6">
                {/* --- IMAGERY SECTION --- */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-purple-600 px-6 py-4 flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Scan className="text-white w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Actes d'Imagerie</h2>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Search Bar */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                Rechercher des actes
                            </label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    placeholder="Ex: Scanner, Radio..."
                                    className={`w-full pl-10 pr-4 py-3 h-12 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400 ${fieldErrors['exams'] ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'}`}
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                />
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-purple-600 transition-colors" />

                                {/* Suggestions */}
                                {showSuggestions && searchTerm.length > 0 && (
                                    <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                        {isLoadingSearchResults ? (
                                            <div className="px-4 py-4 text-sm text-slate-500 text-center flex items-center justify-center gap-2">
                                                <Activity className="w-4 h-4 animate-spin text-purple-600" />
                                                <span>Recherche en cours...</span>
                                            </div>
                                        ) : filteredExams.length > 0 ? (
                                            filteredExams.map((exam) => (
                                                <button
                                                    type="button"
                                                    key={exam.id}
                                                    onClick={() => handleToggleExam(exam)}
                                                    className="block w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors border-b border-slate-100 last:border-0 font-medium"
                                                >
                                                    {exam.label}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-4 py-4 text-sm text-slate-500 text-center">
                                                Aucun acte trouvé pour "{searchTerm}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Selected Exams List */}
                        {selectedExams.length > 0 && (
                            <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                                {selectedExams.map(exam => (
                                    <div key={exam.id} className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-100 shadow-sm">
                                        <span className="text-sm font-semibold">{exam.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveExam(exam.id)}
                                            className="p-0.5 hover:bg-purple-100 rounded-full transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Clinical Comments */}
                        <div>
                            <label htmlFor="comment" className="block text-sm font-semibold text-slate-700 mb-1.5">
                                Commentaires Cliniques (Optionnel)
                            </label>
                            <div className="relative">
                                <textarea
                                    id="comment"
                                    rows={3}
                                    placeholder="Ajouter des observations cliniques pertinentes..."
                                    className="w-full px-4 py-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400 resize-y"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                />
                                <FileText className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- CALENDAR SECTION --- */}
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
                            <button
                                type="button"
                                onClick={() => handleTypeChange('frequency')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${prescriptionType === 'frequency'
                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Activity className="w-4 h-4" /> Fréquence
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTypeChange('punctual-frequency')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${prescriptionType === 'punctual-frequency'
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
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${prescriptionType === 'one-time'
                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Syringe className="w-4 h-4" /> Ponctuel
                            </button>
                        </div>

                        {/* Mode Content */}
                        <div className="min-h-[160px]">
                            {prescriptionType === 'one-time' ? (
                                <div className="flex flex-col items-center justify-center text-center p-8 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-right-2 duration-300">
                                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                                        <Calendar className="w-8 h-8 text-indigo-600" />
                                    </div>
                                    <h3 className="text-indigo-900 font-bold text-lg mb-2">Acte d'Imagerie Ponctuel</h3>
                                    <p className="text-slate-600 max-w-md leading-relaxed">
                                        L'acte d'imagerie prescrit sera réalisé une seule fois à la date et heure spécifiée ci dessous.
                                    </p>

                                    <div className="mt-8 w-full max-w-xs">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 text-left">
                                            Date et Heure de l'acte
                                        </label>
                                        <button
                                            onClick={openCalendarModal}
                                            className={`w-full bg-white border hover:border-indigo-300 hover:ring-4 hover:ring-indigo-50 transition-all rounded-xl px-4 py-3 flex items-center gap-3 group shadow-sm text-left ${fieldErrors['startDate'] ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'}`}
                                        >
                                            <div className="bg-indigo-50 group-hover:bg-indigo-100 p-2 rounded-lg transition-colors">
                                                <Calendar className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                {scheduleData.startDateTime ? (
                                                    <>
                                                        <div className="font-bold text-slate-800">
                                                            {new Date(scheduleData.startDateTime).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-medium">
                                                            à {new Date(scheduleData.startDateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-400 font-medium">Sélectionner une date...</span>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // FULL FREQUENCY UI (Restored from PrescriptionForm)
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">

                                    {/* IMMEDIATE DOSE BLOCK (Only for punctual-frequency) */}
                                    {prescriptionType === 'punctual-frequency' && (
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
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scheduleData.dailySchedule === 'everyday' ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                                                {scheduleData.dailySchedule === 'everyday' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                                            </div>
                                            <span className={`text-sm font-medium ${scheduleData.dailySchedule === 'everyday' ? 'text-indigo-900' : 'text-slate-600'}`}>Tous les jours</span>
                                            <input type="radio" className="hidden" checked={scheduleData.dailySchedule === 'everyday'} onChange={() => handleDailyScheduleChange('everyday')} />
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scheduleData.dailySchedule === 'every-other-day' ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                                                {scheduleData.dailySchedule === 'every-other-day' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                                            </div>
                                            <span className={`text-sm font-medium ${scheduleData.dailySchedule === 'every-other-day' ? 'text-indigo-900' : 'text-slate-600'}`}>1 jour / 2</span>
                                            <input type="radio" className="hidden" checked={scheduleData.dailySchedule === 'every-other-day'} onChange={() => handleDailyScheduleChange('every-other-day')} />
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scheduleData.dailySchedule === 'specific-days' ? 'border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                                                {scheduleData.dailySchedule === 'specific-days' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                                            </div>
                                            <span className={`text-sm font-medium ${scheduleData.dailySchedule === 'specific-days' ? 'text-indigo-900' : 'text-slate-600'}`}>Jours spécifiques</span>
                                            <input type="radio" className="hidden" checked={scheduleData.dailySchedule === 'specific-days'} onChange={() => handleDailyScheduleChange('specific-days')} />
                                        </label>
                                    </div>

                                    {/* Specific Days Selector */}
                                    {scheduleData.dailySchedule === 'specific-days' && (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <div className="flex gap-2 w-full">
                                                {DAYS.map((day) => {
                                                    const isSelected = scheduleData.selectedDays?.includes(day);
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={day}
                                                            onClick={() => toggleDay(day)}
                                                            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-lg border-2 transition-all active:scale-95 ${isSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-inner' : 'border-indigo-100 bg-white text-indigo-300 hover:border-indigo-300'}`}
                                                        >
                                                            {day}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Frequency Mode Selection */}
                                    <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100/50">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-xs font-bold text-indigo-900 uppercase tracking-widest">Mode de Fréquence</span>
                                            <div className="flex bg-white rounded-lg border border-indigo-100 p-1 shadow-sm">
                                                {['cycle', 'specific-time', 'simple'].map((m) => (
                                                    <button
                                                        type="button"
                                                        key={m}
                                                        onClick={() => updateSchedule('mode', m)}
                                                        disabled={(scheduleData.dailySchedule === 'every-other-day' || scheduleData.dailySchedule === 'specific-days') && m === 'cycle'}
                                                        className={`px-3 py-2 text-sm font-semibold rounded-md transition-all ${scheduleData.mode === m
                                                            ? 'bg-indigo-100 text-indigo-700'
                                                            : 'text-slate-500 hover:text-slate-700'
                                                            } ${((scheduleData.dailySchedule === 'every-other-day' || scheduleData.dailySchedule === 'specific-days') && m === 'cycle') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {m === 'simple' ? 'Simple' : m === 'cycle' ? 'Cyclique' : 'Heure Fixe'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {scheduleData.mode === 'cycle' ? (
                                            <div className="animate-in fade-in slide-in-from-bottom-2">
                                                <label className="block text-sm font-medium text-indigo-900 mb-2">Répéter toutes les :</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['2', '4', '6', '8', '12', '24'].map((hr) => (
                                                        <button
                                                            type="button"
                                                            key={hr}
                                                            onClick={() => handleIntervalSelect(hr)}
                                                            className={`flex-1 min-w-[60px] py-2 text-sm font-medium border rounded-lg transition-all active:scale-95 ${!scheduleData.isCustomInterval && scheduleData.interval === hr
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
                                                        className={`px-4 py-2 text-sm font-medium border rounded-lg transition-all ${scheduleData.isCustomInterval
                                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                                            : 'bg-white text-slate-600 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50'
                                                            }`}
                                                    >
                                                        Autre
                                                    </button>
                                                </div>
                                                {scheduleData.isCustomInterval && (
                                                    <div className="mt-3 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                                        <input
                                                            type="number"
                                                            value={scheduleData.interval}
                                                            onChange={(e) => updateSchedule('interval', e.target.value)}
                                                            className={`w-24 p-2 text-sm text-center font-bold text-indigo-800 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${fieldErrors['cycleInterval'] ? 'border-red-500 ring-2 ring-red-100' : 'border-indigo-300'}`}
                                                            autoFocus
                                                        />
                                                        <span className="text-sm font-medium text-indigo-800">heures</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : scheduleData.mode === 'simple' ? (
                                            <div className="animate-in fade-in slide-in-from-bottom-2">
                                                <label className="block text-sm font-medium text-indigo-900 mb-2">Fréquence :</label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={scheduleData.simpleCount}
                                                        onChange={(e) => updateSchedule('simpleCount', e.target.value)}
                                                        className="w-20 p-2 text-center text-sm font-bold text-indigo-800 bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                    <span className="text-sm font-semibold text-indigo-700">fois par jours</span>
                                                    <div className="flex items-center gap-1.5 ml-4">
                                                        <label className="block text-xs font-semibold text-slate-500">Durée inter-prises:</label>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <div className="relative">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        placeholder="00"
                                                                        value={parseDuration(scheduleData.intervalDuration || '00:00').h.toString()}
                                                                        onChange={(e) => handleManualTimeChange('hours', e.target.value, 'schedule.intervalDuration')}
                                                                        disabled={parseInt(scheduleData.simpleCount || '0') <= 1}
                                                                        className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${parseInt(scheduleData.simpleCount || '0') <= 1 ? 'opacity-50 cursor-not-allowed border-slate-200' :
                                                                            fieldErrors['interval'] ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'
                                                                            }`}
                                                                    />
                                                                </div>
                                                                <span className="font-bold text-slate-400">:</span>
                                                                <div className="relative">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="59"
                                                                        placeholder="00"
                                                                        value={parseDuration(scheduleData.intervalDuration || '00:00').m.toString()}
                                                                        onChange={(e) => handleManualTimeChange('minutes', e.target.value, 'schedule.intervalDuration')}
                                                                        disabled={parseInt(scheduleData.simpleCount || '0') <= 1}
                                                                        className={`w-16 pl-2 pr-1 py-2 text-center font-bold text-slate-700 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${parseInt(scheduleData.simpleCount || '0') <= 1 ? 'opacity-50 cursor-not-allowed border-slate-200' :
                                                                            fieldErrors['interval'] ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'
                                                                            }`}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                                {/* Standard Times Buttons */}
                                                <div className="flex gap-3">
                                                    {STANDARD_TIMES.map(({ label, time, icon: Icon }) => {
                                                        const isSelected = scheduleData.specificTimes.includes(time);
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
                                                                <option key={h} value={h} disabled={scheduleData.specificTimes.includes(h)}>
                                                                    {h}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                                                    </div>
                                                </div>

                                                {/* Selected Times Chips */}
                                                {scheduleData.specificTimes && scheduleData.specificTimes.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-2">
                                                        {scheduleData.specificTimes.sort().map(time => (
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
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-px bg-slate-100 w-full" />

                                    {/* Date & Duration */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date de Début <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <input
                                                    type="datetime-local"
                                                    min={getMinDateTimeForInput()}
                                                    className={`w-full pl-3 pr-10 py-2.5 h-12 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 [&::-webkit-calendar-picker-indicator]:hidden ${isSpecificTimeRestricted ? 'bg-slate-100 cursor-pointer' : 'bg-slate-50 border-slate-200'}`}
                                                    value={scheduleData.startDateTime}
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
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Durée de Traitement <span className="text-red-500">*</span></label>
                                            <div className={`flex shadow-sm rounded-xl overflow-hidden border h-12 ${fieldErrors['duration'] ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'}`}>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder="--"
                                                    className="flex-1 text-center bg-white outline-none text-sm font-medium h-full selection:bg-indigo-100 border-none focus:ring-0 p-2"
                                                    value={scheduleData.durationValue === '--' ? '' : scheduleData.durationValue}
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
                                                    onClick={() => updateSchedule('durationUnit', scheduleData.durationUnit === 'days' ? 'weeks' : 'days')}
                                                    className="w-1/2 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-600 transition"
                                                >
                                                    {scheduleData.durationUnit === 'days' ? 'Jours' : 'Semaines'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* --- SCHEDULE DETAILS (EMBEDDED) --- */}
                        {['frequency', 'punctual-frequency'].includes(prescriptionType) && (
                            <div className="pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center gap-2 mb-4 p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl">
                                    <Clock className="w-5 h-5 text-indigo-600" />
                                    <h3 className="font-bold text-indigo-900 text-sm">Détail des horaires calculés</h3>
                                    {(modifiedEventsSummary || skippedEventsSummary) && (
                                        <div className="flex flex-wrap gap-2 ml-auto">
                                            {modifiedEventsSummary && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{modifiedEventsSummary}</span>}
                                            {skippedEventsSummary && <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">{skippedEventsSummary}</span>}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    {getDoseScheduleCards.needsDetail ? (
                                        <div className="space-y-3">
                                            {finalDoses.map((dose, index) => {
                                                const isEditing = editingDoseId === dose.id;
                                                const showDateHeader = index === 0 || finalDoses[index - 1].date.getDate() !== dose.date.getDate();
                                                const isModified = manuallyAdjustedEvents.has(dose.id);
                                                const isSkipped = skippedEvents.includes(dose.id);

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

                                                        {isEditing ? (
                                                            <DoseEditor
                                                                dose={dose}
                                                                prevDoseEnd={index > 0 ? getDoseScheduleCards.cards[index - 1].date : new Date(dose.date.getTime() - 24 * 60 * 60 * 1000)}
                                                                nextDoseStart={index < getDoseScheduleCards.cards.length - 1 ? getDoseScheduleCards.cards[index + 1].date : new Date(dose.date.getTime() + 24 * 60 * 60 * 1000)}
                                                                onSave={handleSaveDose}
                                                                onCancel={handleCancelEdit}
                                                                adminMode="instant"
                                                                adminDuration="00:00"
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
                                                                        : isModified
                                                                            ? 'bg-amber-100 text-amber-600'
                                                                            : 'bg-indigo-50 text-indigo-600'
                                                                        }`}>
                                                                        {isSkipped ? <CalendarOff size={18} /> : <Clock size={18} />}
                                                                    </div>

                                                                    <div className="flex flex-col">
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
                                                                        </div>
                                                                        <span className="text-xs font-medium text-slate-400 capitalize">
                                                                            {isSkipped ? 'Prise ignorée' :
                                                                                isModified ? 'Horaire personnalisé' :
                                                                                    'Horaire standard'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {!isSkipped && (
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
                                                                            <button
                                                                                onClick={() => handleEditDose(dose.id)}
                                                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                                title="Modifier l'horaire"
                                                                            >
                                                                                <Edit2 size={16} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleToggleDoseSkipped(dose.id)}
                                                                        className={`p-2 rounded-lg transition-colors ${isSkipped
                                                                            ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                                                                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                                                            }`}
                                                                        title={isSkipped ? "Rétablir la prise" : "Ignorer cette prise"}
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
                                            <p className="text-sm font-medium">{getDoseScheduleCards.message || "Configurez la fréquence ci-dessus."}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>



                {/* --- PREVIEW SECTION --- */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-800 px-6 py-4 flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <FileText className="text-white w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Aperçu de l'Ordonnance</h2>
                    </div>

                    <div className="p-6 bg-slate-50/50">
                        <PrescriptionCard formData={previewData} />
                    </div>
                </div>
            </div>

            {/* Validation Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 animate-in shake">
                    <div className="bg-white p-1.5 rounded-full shadow-sm">
                        <X className="w-5 h-5 text-red-600" />
                    </div>
                    <p className="text-red-700 font-medium text-sm">{error}</p>
                </div>
            )}

            {/* Validation Messages Overlay */}
            {(error || warning) && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-lg px-4 pointer-events-none">
                    {error && (
                        <div className="pointer-events-auto bg-red-50 text-red-800 px-4 py-3 rounded-xl shadow-lg border border-red-200 flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
                            <p className="text-sm font-medium">{error}</p>
                            <button onClick={() => setError(null)} className="ml-auto hover:bg-red-100 p-1 rounded-full text-red-600 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                    )}
                    {warning && (
                        <div className="pointer-events-auto bg-amber-50 text-amber-900 px-4 py-3 rounded-xl shadow-lg border border-amber-200 flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                            <p className="text-sm font-medium">{warning}</p>
                            <button onClick={() => setWarning(null)} className="ml-auto hover:bg-amber-100 p-1 rounded-full text-amber-600 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 border-t border-slate-200">
                <button
                    type="button"
                    onClick={() => {
                        setSelectedExams([]);
                        setSearchTerm('');
                        setComment('');
                        setError(null);
                        setWarning(null);
                        setPrescriptionType('one-time');
                        setScheduleData(prev => ({ ...prev, startDateTime: getCurrentDateTime() }));
                    }}
                    className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.98]"
                >
                    <div className="flex items-center justify-center gap-2">
                        <X className="w-5 h-5" />
                        <span>Effacer</span>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={handleValidate}
                    className={`flex-1 px-6 py-3 font-bold rounded-xl transition-all shadow-md active:scale-[0.98] ${getValidationState().isValid
                        ? 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/25'
                        : 'bg-slate-300 text-slate-500 hover:bg-slate-300 cursor-pointer'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        <span>Valider la Prescription</span>
                    </div>
                </button>
            </div>
        </div>
    );
};
