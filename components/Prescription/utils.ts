import { FormData } from './types';

export const FULL_DAYS_MAP: Record<string, string> = {
    'Lun': 'Lundi',
    'Mar': 'Mardi',
    'Mer': 'Mercredi',
    'Jeu': 'Jeudi',
    'Ven': 'Vendredi',
    'Sam': 'Samedi',
    'Dim': 'Dimanche'
};

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
