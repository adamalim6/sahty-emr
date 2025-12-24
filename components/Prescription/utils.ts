import { FormData, ScheduleData, DoseScheduleResult } from './types';


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

// Helper to convert HH:mm string to decimal hours (e.g. "01:30" -> 1.5)
export const durationToDecimal = (duration: string): number => {
    if (!duration) return 0;
    if (!duration.includes(':')) return parseFloat(duration) || 0;
    const [h, m] = duration.split(':').map(Number);
    return (h || 0) + (m || 0) / 60;
};

// Helper to format HH:mm string to display format (e.g. "01:30" -> "1h30")
export const formatDuration = (duration: string): string => {
    if (!duration) return '--';
    if (!duration.includes(':')) return `${duration}h`;
    const [h, m] = duration.split(':');
    return `${parseInt(h)}h${m}`;
};

export const getPosologyText = (formData: FormData): string | null => {
    if (!formData || !formData.schedule) return null;
    const { type, schedule, adminMode, dilutionRequired, solvent } = formData;

    if (!schedule.startDateTime && type !== 'punctual-frequency') return null;
    if (type === 'punctual-frequency' && !schedule.startDateTime) return null;

    const startDateObj = new Date(schedule.startDateTime);
    if (isNaN(startDateObj.getTime())) return null;

    const dateStr = startDateObj.toLocaleDateString('fr-FR');
    const timeStr = startDateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const durationText = `${formData.schedule.durationValue === '--' ? '0' : formData.schedule.durationValue} ${formData.schedule.durationUnit === 'days' ? 'jours' : 'semaines'}`;

    let solventText = "";
    if (dilutionRequired && solvent?.molecule && solvent?.qty && solvent?.unit && solvent.qty !== '--') {
        const solventName = solvent.commercialName || solvent.molecule;
        solventText = ` (dilué dans ${solvent.qty} ${solvent.unit} de ${solventName})`;
    }

    if (adminMode === 'permanent') {
        return `En continu pendant ${durationText} à partir du ${dateStr} à ${timeStr}${solventText}.`;
    }

    if (type === 'one-time') {
        return `Une seule fois le ${dateStr} à ${timeStr}${solventText}.`;
    }

    if (type === 'frequency' || type === 'punctual-frequency') {
        let prefix = "";
        if (type === 'punctual-frequency') {
            prefix = "1 prise immédiatement, puis ";
        }

        let daysText = "";
        if (schedule.dailySchedule === 'everyday') {
            daysText = type === 'punctual-frequency' ? "tous les jours" : "Tous les jours";
        } else if (schedule.dailySchedule === 'every-other-day') {
            daysText = type === 'punctual-frequency' ? "un jour sur deux" : "Un jour sur deux";
        }
        else if (schedule.selectedDays && schedule.selectedDays.length > 0) {
            const fullDays = schedule.selectedDays.map(d => FULL_DAYS_MAP[d]);
            if (fullDays.length === 1) {
                daysText = type === 'punctual-frequency' ? `le ${fullDays[0]}` : `Le ${fullDays[0]}`;
            } else {
                const lastDay = fullDays.pop();
                daysText = type === 'punctual-frequency' ? `les ${fullDays.join(', ')} et ${lastDay}` : `Le ${fullDays.join(', ')} et ${lastDay}`;
            }
        } else {
            daysText = "Tous les jours";
        }

        let modeText = "";
        if (schedule.mode === 'cycle') {
            const interval = schedule.interval || '?';
            modeText = `, toutes les ${interval}h`;
        } else if (schedule.mode === 'simple') {
            const numDoses = parseInt(schedule.simpleCount || '0');
            const intervalDuration = schedule.intervalDuration;
            modeText = `, ${numDoses} fois par jour`;
            if (numDoses > 1 && intervalDuration && durationToDecimal(intervalDuration) > 0) {
                modeText += `, avec un intervalle de ${formatDuration(intervalDuration)} entre chaque prise`;
            }
        } else {
            if (schedule.specificTimes && Array.isArray(schedule.specificTimes) && schedule.specificTimes.length > 0) {
                const sortedTimes = [...schedule.specificTimes].sort();
                const lastTime = sortedTimes.pop();
                const timesStr = sortedTimes.length > 0 ? `${sortedTimes.join(', ')} et ${lastTime}` : lastTime;
                modeText = `, à ${timesStr}`;
            } else {
                modeText = ", à heures fixes";
            }
        }

        if (type === 'punctual-frequency') {
            if (daysText.startsWith("Tous")) daysText = "tous";
            if (daysText.startsWith("Un")) daysText = "un";
        }

        return `${prefix}${daysText}${modeText} pendant ${durationText} à partir du ${dateStr} à ${timeStr}${solventText}.`;
    }

    return null;
};

// Reused Logic for Dose Generation
export const generateDoseSchedule = (
    scheduleData: ScheduleData,
    prescriptionType: string,
    type?: string,
    adminMode: string = 'standard',
    adminDuration: string = '00:00'
): DoseScheduleResult => {
    const { startDateTime, durationValue, durationUnit, dailySchedule, selectedDays, mode, interval, specificTimes, simpleCount, intervalDuration } = scheduleData;
    // Support legacy calls where the second argument was the schedule type (e.g. 'frequency')
    const effectiveType = type || prescriptionType;

    if (!startDateTime || (['frequency', 'punctual-frequency'].includes(effectiveType) && (durationValue === '--' || parseFloat(durationValue) <= 0))) {
        return { needsDetail: false, message: "Veuillez compléter la date de début et la durée de traitement pour voir le détail des prises.", cards: [], allDosesMap: new Map(), isError: false };
    }

    const startDate = new Date(startDateTime);
    if (isNaN(startDate.getTime())) {
        return { needsDetail: false, message: "Date de début invalide.", cards: [], allDosesMap: new Map(), isError: false };
    }

    if (effectiveType === 'one-time') {
        const oneTimeDose = {
            id: startDate.toISOString(),
            date: startDate,
            time: startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };
        const singleDoseMap = new Map().set(oneTimeDose.id, oneTimeDose);
        return { needsDetail: true, message: null, cards: [oneTimeDose], allDosesMap: singleDoseMap, isError: false };
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
        const id = dose.toISOString(); // Use ISO as ID to match form behavior
        // Actually, the original form uses a more complex ID if it's based on index?
        // Wait, line 603 in TransfusionPrescriptionForm uses `calculatedDose-${i}-${j}` or similar?
        // Ah, looking at the previous file view of TransfusionPrescriptionForm...
        // lines 598-600 are currently using `dose.toISOString()`.
        // Let's verify line 600 in TransfusionPrescriptionForm from previous read.
        // It says: `const id = dose.toISOString();`
        // So recreating it as ISO is correct.

        uniqueDosesMap.set(id, {
            id,
            date: dose,
            time: dose.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        });
    });

    const sortedDoses = Array.from(uniqueDosesMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
        needsDetail: true,
        message: null,
        cards: sortedDoses,
        allDosesMap: uniqueDosesMap,
        isError: false
    };
};
