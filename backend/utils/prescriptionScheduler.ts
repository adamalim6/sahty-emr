import { ScheduleData } from '../models/prescription';

// Import equivalent types if missing from models, or redefine here
// Since they aren't fully detailed in backend/models/prescription.ts, we'll redefine locally what's strictly needed for the scheduler
export interface BackendScheduledDose {
    id: string;
    plannedDateTime: string;
    effectiveDateTime: string | null;
    isSkipped: boolean;
}

export interface BackendDoseScheduleResult {
    needsDetail: boolean;
    message: string | null;
    cards: any[];
    scheduledDoses: BackendScheduledDose[];
    allDosesMap: Map<string, any>;
    isError: boolean;
}

export const FULL_DAYS_MAP: Record<string, string> = {
    'Lun': 'Lundi',
    'Mar': 'Mardi',
    'Mer': 'Mercredi',
    'Jeu': 'Jeudi',
    'Ven': 'Vendredi',
    'Sam': 'Samedi',
    'Dim': 'Dimanche'
};

const SHORT_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const durationToDecimal = (duration: string): number => {
    if (!duration) return 0;
    if (!duration.includes(':')) return parseFloat(duration) || 0;
    const [h, m] = duration.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
};

// Extracted exactly from frontend for 100% fidelity
export const generateDoseSchedule = (
    scheduleData: any, // Using any here to bypass strict typing mismatch on the backend side if needed
    prescriptionType: string,
    type?: string,
    adminMode: string = 'standard',
    adminDuration: string = '00:00',
    overrides?: {
        skippedEvents?: string[];
        manuallyAdjustedEvents?: Record<string, string>;
    }
): BackendDoseScheduleResult => {
    const { startDateTime, durationValue, durationUnit, dailySchedule, selectedDays, mode, interval, specificTimes, simpleCount, intervalDuration } = scheduleData;
    const effectiveType = type || prescriptionType;

    if (!startDateTime || (['frequency', 'punctual-frequency'].includes(effectiveType) && (durationValue === '--' || parseFloat(durationValue) <= 0))) {
        return { needsDetail: false, message: "Veuillez compléter la date de début et la durée de traitement pour voir le détail des prises.", cards: [], scheduledDoses: [], allDosesMap: new Map(), isError: false };
    }

    const startDate = new Date(startDateTime);
    if (isNaN(startDate.getTime())) {
        return { needsDetail: false, message: "Date de début invalide.", cards: [], scheduledDoses: [], allDosesMap: new Map(), isError: false };
    }

    if (effectiveType === 'one-time') {
        const oneTimeDose = {
            id: startDate.toISOString(),
            date: startDate,
            time: startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };
        const singleDoseMap = new Map().set(oneTimeDose.id, oneTimeDose);
        const scheduledDoses: BackendScheduledDose[] = [{
            id: oneTimeDose.id,
            plannedDateTime: oneTimeDose.id,
            effectiveDateTime: overrides?.manuallyAdjustedEvents?.[oneTimeDose.id] || null,
            isSkipped: overrides?.skippedEvents?.includes(oneTimeDose.id) || false
        }];
        return { needsDetail: true, message: null, cards: [oneTimeDose], scheduledDoses, allDosesMap: singleDoseMap, isError: false };
    }

    // Remaining complex logic precisely mirrored
    if (mode === 'simple') {
        const numDoses = parseInt(simpleCount || '0');
        const intervalDurationDecimal = durationToDecimal(intervalDuration || '00:00');

        if (numDoses > 1 && intervalDurationDecimal <= 0) {
            return {
                needsDetail: true,
                message: "Veuillez remplir la durée inter-prise pour générer le détail des prises",
                cards: [],
                scheduledDoses: [],
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
                    scheduledDoses: [],
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
    if (effectiveType === 'punctual-frequency') {
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
    } else {
        let dayIterator = new Date(startDate);
        dayIterator.setHours(0, 0, 0, 0);

        while (dayIterator.getTime() <= endDate.getTime()) {
            let isDayEligible = false;
            const dayOfWeekShort = SHORT_DAYS[dayIterator.getDay() === 0 ? 6 : dayIterator.getDay() - 1];

            if (dailySchedule === 'everyday') {
                isDayEligible = true;
            } else if (dailySchedule === 'every-other-day') {
                const startDayOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                const diffTime = dayIterator.getTime() - startDayOnly.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                isDayEligible = (diffDays % 2 === 0);
            } else if (dailySchedule === 'specific-days' && selectedDays?.length > 0) {
                isDayEligible = selectedDays.includes(dayOfWeekShort);
            }

            if (isDayEligible) {
                if (mode === 'specific-time' && specificTimes?.length > 0) {
                    specificTimes.forEach((time: string) => {
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
        uniqueDosesMap.set(id, {
            id,
            date: dose,
            time: dose.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        });
    });

    const sortedDoses = Array.from(uniqueDosesMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    const scheduledDoses: BackendScheduledDose[] = Array.from(uniqueDosesMap.values()).map(d => {
        const id = d.id;
        const isSkipped = overrides?.skippedEvents?.includes(id) || false;
        const adjustedDateStr = overrides?.manuallyAdjustedEvents?.[id];

        return {
            id,
            plannedDateTime: id,
            effectiveDateTime: adjustedDateStr || null,
            isSkipped
        };
    });

    return {
        needsDetail: true,
        message: null,
        cards: sortedDoses,
        scheduledDoses,
        allDosesMap: uniqueDosesMap,
        isError: false
    };
};
