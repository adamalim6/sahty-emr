import React from 'react';
import {
    Pill,
    Calendar,
    Clock,
    Activity,
    FlaskConical,
    FileText,
    AlertCircle,
    Timer,
    TestTube,
    Scan,
    Stethoscope,
    Droplet
} from 'lucide-react';
import { FormData } from './types';
import { getPosologyText, formatDuration, generateDoseSchedule } from './utils';

interface PrescriptionCardProps {
    formData: FormData;
    extraContent?: React.ReactNode;
    manualDoseAdjustments?: Map<string, string>;
}

export const PrescriptionCard: React.FC<PrescriptionCardProps> = ({ formData, extraContent, manualDoseAdjustments }) => {
    const { schedule, type, adminMode } = formData;
    const { startDateTime, durationValue } = schedule;
    const startDate = new Date(startDateTime);

    const scheduleResult = generateDoseSchedule(schedule, 'medication', type, adminMode, formData.adminDuration);

    // Apply manual adjustments if present
    if (manualDoseAdjustments && manualDoseAdjustments.size > 0 && scheduleResult.cards.length > 0) {
        const adjustedCards = scheduleResult.cards.map(card => {
            if (manualDoseAdjustments.has(card.id)) {
                const newTime = manualDoseAdjustments.get(card.id)!;
                const dateObj = new Date(newTime);
                return {
                    ...card,
                    date: dateObj,
                    time: dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    originalDate: card.date // Keep track of original for reset
                };
            }
            return card;
        });
        adjustedCards.sort((a, b) => a.date.getTime() - b.date.getTime());
        scheduleResult.cards = adjustedCards;
    }
    // We can reuse getPosologyText for medical prescriptions and also for biology if we adapt it or check if it works.
    // However, the `getPosologyText` usually talks about "Prendre" or "Administrer". 
    // For Biology, we might want "Réaliser" or "Faire".
    // Let's create a specific biology text generator right here or reuse getPosologyText if generic enough.
    // Actually, getPosologyText relies on formData properties. 
    // Biology form uses the exact same `schedule` structure.

    // Generic description generator for Biology, Imagery and Care
    const getProcedureDescription = (data: FormData): string | null => {
        if (!data.schedule || !data.schedule.startDateTime) return null;

        const startDate = new Date(data.schedule.startDateTime);
        const dateStr = startDate.toLocaleDateString('fr-FR');
        const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        if (data.type === 'one-time') {
            return `À faire le ${dateStr} à ${timeStr}`;
        }

        // For frequency / punctual-frequency, we can reuse logic similar to getPosologyText logic
        // but tailored for exams.

        let freqText = "";
        const schedule = data.schedule;

        // Daily schedule part
        if (schedule.dailySchedule === 'everyday') freqText = "Tous les jours";
        else if (schedule.dailySchedule === 'every-other-day') freqText = "Un jour sur deux";
        else if (schedule.dailySchedule === 'specific-days' && schedule.selectedDays && schedule.selectedDays.length > 0) {
            freqText = `Les ${schedule.selectedDays.join(', ')}`;
        }

        // Intra-day schedule part
        let modeText = "";
        if (schedule.mode === 'simple') {
            modeText = `${schedule.simpleCount} fois par jour`;
        } else if (schedule.mode === 'cycle') {
            modeText = `toutes les ${schedule.interval}h`;
        } else if (schedule.mode === 'specific-time' && schedule.specificTimes.length > 0) {
            modeText = `à ${schedule.specificTimes.join(', ')}`;
        }

        // Duration part
        let durationText = "";
        if (schedule.durationValue && schedule.durationValue !== '--') {
            const unit = schedule.durationUnit === 'weeks' ? 'semaines' : 'jours';
            durationText = `pendant ${schedule.durationValue} ${unit}`;
        }

        // Start date part
        const startText = `à partir du ${dateStr} à ${timeStr}`;

        // Combine everything
        let fullText = [freqText, modeText, durationText, startText].filter(Boolean).join(', ');

        // Specific handling for Ponct + Freq
        if (data.type === 'punctual-frequency') {
            // Logic for immediate dose is implied by the type, usually we might add "1 prise tout de suite puis..."
            // But user asked for specific format: "Tous les jours, toutes les 6h..."
            // The medical form usually generates "1 prise immédiate puis..." if applicable.
            // If the user wants EXACTLY "Tous les jours..." then the standard generation above works.
            // If we want to mention the immediate aspect:
            const immediateText = "Réaliser maintenant, puis";
            fullText = `${immediateText} ${fullText}`;
        }

        // Capitalize first letter
        return fullText.charAt(0).toUpperCase() + fullText.slice(1);
    };

    const posologyText = (formData.prescriptionType === 'biology' || formData.prescriptionType === 'imagery' || formData.prescriptionType === 'care')
        ? getProcedureDescription(formData)
        : getPosologyText(formData);

    if (!formData.molecule) {
        return (
            <div className="flex flex-col items-center text-center text-slate-400 py-4">
                <Activity className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Remplissez le formulaire pour voir l'aperçu</p>
            </div>
        );
    }

    // Unified Schedule Description Component
    const ScheduleDisplay = ({ text }: { text: string | null }) => {
        if (!text) return null;
        return (
            <div className="flex items-start gap-3 bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900 mt-2 animate-in fade-in slide-in-from-left-2">
                <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                <p className="font-medium leading-relaxed">{text}</p>
            </div>
        );
    };

    if (formData.prescriptionType === 'biology') {
        const bioDescription = getProcedureDescription(formData);

        return (
            <div className="space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-blue-800">{formData.molecule}</h2>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                            Examen Biologique
                        </span>
                    </div>
                    <div className="bg-blue-100 rounded-full p-2">
                        <TestTube className="w-5 h-5 text-blue-600" />
                    </div>
                </div>

                {formData.conditionComment && formData.conditionComment.trim().length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-500" />
                        <span className="leading-tight">Commentaire: <strong>{formData.conditionComment.trim()}</strong></span>
                    </div>
                )}

                <ScheduleDisplay text={bioDescription} />
            </div>
        );
    }

    if (formData.prescriptionType === 'imagery') {
        const imgDescription = getProcedureDescription(formData);

        return (
            <div className="space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-purple-800">{formData.molecule}</h2>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                            Acte d'Imagerie
                        </span>
                    </div>
                    <div className="bg-purple-100 rounded-full p-2">
                        <Scan className="w-5 h-5 text-purple-600" />
                    </div>
                </div>

                {formData.conditionComment && formData.conditionComment.trim().length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-500" />
                        <span className="leading-tight">Commentaire: <strong>{formData.conditionComment.trim()}</strong></span>
                    </div>
                )}

                <ScheduleDisplay text={imgDescription} />
            </div>
        );
    }

    if (formData.prescriptionType === 'care') {
        const careDescription = getProcedureDescription(formData);

        return (
            <div className="space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-orange-800">{formData.molecule}</h2>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                            Acte & Soin
                        </span>
                    </div>
                    <div className="bg-orange-100 rounded-full p-2">
                        <Stethoscope className="w-5 h-5 text-orange-600" />
                    </div>
                </div>

                {formData.conditionComment && formData.conditionComment.trim().length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-500" />
                        <span className="leading-tight">Instructions: <strong>{formData.conditionComment.trim()}</strong></span>
                    </div>
                )}

                <ScheduleDisplay text={careDescription} />
            </div>
        );
    }

    if (formData.prescriptionType === 'transfusion') {
        const transDescription = getProcedureDescription(formData);

        return (
            <div className="space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-rose-800">{formData.molecule}</h2>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 mt-1">
                            Transfusion Sanguine
                        </span>
                    </div>
                    <div className="bg-rose-100 rounded-full p-2">
                        <Droplet className="w-5 h-5 text-rose-600" />
                    </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-rose-900 bg-rose-50/50 p-3 rounded-lg border border-rose-100 shadow-sm">
                    <span className="font-bold text-rose-700">{formData.qty === '--' ? '0' : formData.qty} {formData.unit}</span>
                    <span className="text-rose-200">|</span>
                    <span className="font-medium">{formData.route}</span>
                </div>

                {formData.conditionComment && formData.conditionComment.trim().length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-yellow-900 bg-yellow-100 px-3 py-2 rounded-lg border border-yellow-200 animate-in fade-in">
                        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-yellow-600" />
                        <span className="leading-tight">Instructions: <strong>{formData.conditionComment.trim()}</strong></span>
                    </div>
                )}

                {formData.adminMode === 'continuous' && formData.adminDuration && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 animate-in fade-in">
                        <Timer className="w-3 h-3" />
                        <span>Administration sur une durée de <strong>{formatDuration(formData.adminDuration)}</strong></span>
                    </div>
                )}

                <ScheduleDisplay text={transDescription} />

                {formData.skippedDoses && formData.skippedDoses.length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
                        <div>
                            <span className="font-bold block mb-1">Transfusion(s) annulée(s) :</span>
                            <ul className="list-disc pl-4 space-y-0.5">
                                {formData.skippedDoses.map(dateStr => {
                                    const d = new Date(dateStr);
                                    return (
                                        <li key={dateStr}>
                                            {d.toLocaleDateString('fr-FR')} à {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                )}

                {formData.manualDoseAdjustments && Object.keys(formData.manualDoseAdjustments).length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-indigo-800 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 animate-in fade-in">
                        <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-600" />
                        <div>
                            <span className="font-bold block mb-1">Horaires modifiés manuellement :</span>
                            <ul className="list-disc pl-4 space-y-0.5">
                                {(() => {
                                    // Calculate original schedule to find original times
                                    const scheduleType = formData.type || 'frequency'; // Fallback
                                    const scheduleResult = generateDoseSchedule(formData.schedule, formData.prescriptionType || 'medication', scheduleType, 'standard', '00:00');
                                    const allDosesMap = scheduleResult.allDosesMap;

                                    const modifiedDetails: Array<{ originalDate?: Date; newDate: Date; id: string }> = [];
                                    Object.entries(formData.manualDoseAdjustments).forEach(([id, dateStr]) => {
                                        const newDate = new Date(dateStr);
                                        const originalDose = allDosesMap.get(id);
                                        modifiedDetails.push({
                                            originalDate: originalDose?.date,
                                            newDate: newDate,
                                            id
                                        });
                                    });

                                    // Sort by new date
                                    modifiedDetails.sort((a, b) => a.newDate.getTime() - b.newDate.getTime());

                                    return modifiedDetails.map((detail, idx) => (
                                        <li key={idx} className="flex flex-wrap items-center gap-1">
                                            {detail.originalDate && (
                                                <span className="line-through opacity-60">
                                                    {detail.originalDate.toLocaleDateString('fr-FR')} à {detail.originalDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                            {detail.originalDate && <span className="text-indigo-400 mx-1">→</span>}
                                            <span className="font-bold">
                                                {detail.newDate.toLocaleDateString('fr-FR')} à {detail.newDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </li>
                                    ));
                                })()}
                            </ul>
                        </div>
                    </div>
                )}

                {extraContent}
            </div>
        );
    }



    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">{formData.commercialName || formData.molecule}</h2>
                    <p className="text-sm text-slate-500">{formData.commercialName ? `(${formData.molecule})` : 'Générique'}</p>
                </div>
                <div className="bg-slate-200 rounded-full p-2">
                    <Pill className="w-5 h-5 text-slate-600" />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                    <span className="font-bold text-emerald-700">{formData.qty === '--' ? '0' : formData.qty} {formData.unit}</span>
                    <span className="text-slate-300">|</span>
                    <span>{formData.route}</span>
                </div>
                {formData.adminMode === 'continuous' && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                        <Timer className="w-3 h-3" />
                        <span>Administration sur une durée de <strong>{formatDuration(formData.adminDuration)}</strong></span>
                    </div>
                )}
                {formData.adminMode === 'permanent' && (
                    <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                        <Activity className="w-3 h-3" />
                        <span>Administration en continu</span>
                    </div>
                )}
                {formData.dilutionRequired && formData.solvent && formData.solvent.molecule && formData.solvent.qty !== '--' && formData.solvent.unit && (
                    <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
                        <FlaskConical className="w-3 h-3" />
                        <span>Dilué dans <strong>{formData.solvent.qty} {formData.solvent.unit} de {formData.solvent.commercialName || formData.solvent.molecule}</strong></span>
                    </div>
                )}
                {formData.conditionComment && formData.conditionComment.trim().length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-600" />
                        <span className="leading-tight">Condition / Commentaire: <strong>{formData.conditionComment.trim()}</strong></span>
                    </div>
                )}
                {/* Substitutable Alert */}
                {!formData.substitutable && (
                    <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3 py-2 rounded-lg border border-red-100 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="font-bold">Non substituable</span>
                    </div>
                )}
            </div>

            {/* Natural Language Posology Card */}
            <ScheduleDisplay text={posologyText} />

            {/* Skipped Doses Display - Moved Below Posology */}
            {formData.skippedDoses && formData.skippedDoses.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
                    <div>
                        <span className="font-bold block mb-1">Prises sautées :</span>
                        <ul className="list-disc pl-4 space-y-0.5">
                            {formData.skippedDoses.map(dateStr => {
                                const d = new Date(dateStr);
                                return (
                                    <li key={dateStr}>
                                        {d.toLocaleDateString('fr-FR')} à {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}

            {/* Modified Doses Display (Medication, Biology, Imagery, Care) */}
            {(() => {
                const adjustmentsObj = formData.manualDoseAdjustments;

                if (!adjustmentsObj || Object.keys(adjustmentsObj).length === 0) return null;

                // Calculate original schedule to find original times
                const scheduleType = formData.type || 'frequency';
                const baseSchedule = generateDoseSchedule(formData.schedule, 'medication', scheduleType, formData.adminMode, formData.adminDuration);
                const allDosesMap = baseSchedule.allDosesMap;

                const modifiedDetails: Array<{ originalDate?: Date; newDate: Date; id: string }> = [];
                Object.entries(adjustmentsObj).forEach(([id, dateStr]) => {
                    const newDate = new Date(dateStr);
                    const originalDose = allDosesMap.get(id);
                    modifiedDetails.push({
                        originalDate: originalDose?.date,
                        newDate: newDate,
                        id
                    });
                });

                // Sort by new date
                modifiedDetails.sort((a, b) => a.newDate.getTime() - b.newDate.getTime());

                return (
                    <div className="flex items-start gap-2 text-xs text-indigo-800 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 animate-in fade-in">
                        <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-600" />
                        <div>
                            <span className="font-bold block mb-1">Horaires modifiés manuellement :</span>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                {modifiedDetails.map((detail, idx) => (
                                    <li key={idx} className="flex flex-wrap items-center gap-1">
                                        {detail.originalDate && (
                                            <span className="line-through opacity-60">
                                                {detail.originalDate.toLocaleDateString('fr-FR')} à {detail.originalDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                        {detail.originalDate && <span className="text-indigo-400 mx-1">→</span>}
                                        <span className="font-bold">
                                            {detail.newDate.toLocaleDateString('fr-FR')} à {detail.newDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
            })()}

            {extraContent}

            {(() => {
                const isPunctual = formData.type === 'punctual-frequency';
                const displayDate = isPunctual
                    ? new Date()
                    : (formData.schedule.startDateTime ? new Date(formData.schedule.startDateTime) : null);

                const shouldShowDateInfo = isPunctual || (displayDate && !isNaN(displayDate.getTime()));

                if (!shouldShowDateInfo || !displayDate) return null;

                // For biology, imagery, care and transfusion, we already returned early or 
                // showed detailed info, so this block is logically intended for medication.
                if (formData.prescriptionType && formData.prescriptionType !== 'medication') return null;

                return (
                    <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-200">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>Début : {displayDate.toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>Heure : {displayDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
