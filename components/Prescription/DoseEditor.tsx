import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { durationToDecimal } from './utils';

interface Dose {
    date: Date;
    time: string;
    id: string;
    originalDate?: Date;
    originalTime?: string;
    isModified?: boolean;
    skipped?: boolean;
}

interface DoseEditorProps {
    dose: Dose;
    prevDoseEnd: Date;
    nextDoseStart: Date;
    onSave: (newTime: string) => void;
    onCancel: () => void;
    adminMode: string;
    adminDuration: string;
}

export const DoseEditor: React.FC<DoseEditorProps> = ({
    dose,
    prevDoseEnd,
    nextDoseStart,
    onSave,
    onCancel,
    adminMode,
    adminDuration
}) => {
    const durationHours = (adminMode !== 'instant') ? durationToDecimal(adminDuration) : 0;

    // Effective duration of CURRENT dose in ms
    const currentDoseDurationMs = durationHours * 60 * 60 * 1000;
    const BUFFER_MS = 5 * 60 * 1000; // 5 min buffer

    // Safe Bounds
    const minStartMs = prevDoseEnd.getTime() + BUFFER_MS;
    const maxStartMs = nextDoseStart.getTime() - currentDoseDurationMs - BUFFER_MS;

    // Reference Point: Original Scheduled Time (Immuable)
    // If originalDate is missing (first edit), fallback to current dose date.
    const originalDate = dose.originalDate || dose.date;
    const anchorTimeMs = originalDate.getTime();

    // Initial State Calculation based on Current Dose (dose.date)
    const currentDoseTimeMs = dose.date.getTime();

    // Bounds relative to Anchor
    const maxPosDelta = Math.max(0, maxStartMs - anchorTimeMs);
    const maxNegDelta = Math.max(0, anchorTimeMs - minStartMs);

    // Initial Slider Value
    // We map the current time's offset from anchor to the slider's -100..100 range
    // Linear or cubic mapping? The original code used cubic for precision near center.
    // We stick to cubic mapping for consistency.
    const getInitialSliderValue = () => {
        const diff = currentDoseTimeMs - anchorTimeMs;
        if (diff === 0) return 0;

        if (diff > 0) {
            if (maxPosDelta === 0) return 100;
            // deltaMs = maxPosDelta * (val/100)^3
            // val/100 = cbrt(deltaMs / maxPosDelta)
            return Math.round(Math.cbrt(diff / maxPosDelta) * 100);
        } else {
            if (maxNegDelta === 0) return -100;
            // deltaMs = -maxNegDelta * (abs(val)/100)^3
            // -deltaMs / maxNegDelta = (abs(val)/100)^3
            return -Math.round(Math.cbrt(-diff / maxNegDelta) * 100);
        }
    };

    const [sliderValue, setSliderValue] = useState(getInitialSliderValue());
    const [rawInput, setRawInput] = useState(dose.time); // This is currentDateTime at first
    const [error, setError] = useState<string | null>(null);
    const [currentValidDate, setCurrentValidDate] = useState<Date>(dose.date);

    // Effect: Handle slider changes
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);

        let deltaMs = 0;
        if (val > 0) {
            deltaMs = maxPosDelta * Math.pow(val / 100, 3);
        } else {
            deltaMs = -maxNegDelta * Math.pow(Math.abs(val) / 100, 3);
        }

        // Exact new time based on anchor AND slider delta
        const newTimeMs = anchorTimeMs + deltaMs;

        if (newTimeMs < minStartMs || newTimeMs > maxStartMs) {
            setError("Chevauchement avec prise adjacente");
        } else {
            setError(null);
        }

        const newDate = new Date(newTimeMs);

        setSliderValue(val);
        setRawInput(newDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        setCurrentValidDate(newDate);
    };

    const handleTimeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setRawInput(val);

        if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val)) {
            const [h, m] = val.split(':').map(Number);

            if (h > 23 || m > 59) return;

            // Resolve candidates starting from currentValidDate (closest day logic)
            const candidates = [-1, 0, 1].map(offset => {
                const d = new Date(currentValidDate);
                d.setDate(d.getDate() + offset);
                d.setHours(h, m, 0, 0);
                return d;
            });

            const validCandidates = candidates.filter(d => {
                const t = d.getTime();
                return t >= minStartMs && t <= maxStartMs;
            });

            if (validCandidates.length > 0) {
                // Pick closest to currentValidDate
                const best = validCandidates.reduce((prev, curr) =>
                    Math.abs(curr.getTime() - currentValidDate.getTime()) < Math.abs(prev.getTime() - currentValidDate.getTime()) ? curr : prev
                );

                setCurrentValidDate(best);
                setError(null);

                // Reverse calc slider relative to ANCHOR
                const diff = best.getTime() - anchorTimeMs; // Diff from original
                let newSlider = 0;
                if (diff > 0 && maxPosDelta > 0) {
                    newSlider = Math.cbrt(diff / maxPosDelta) * 100;
                } else if (diff < 0 && maxNegDelta > 0) {
                    newSlider = -Math.cbrt(-diff / maxNegDelta) * 100;
                }
                setSliderValue(Math.round(newSlider));

            } else {
                setError("Horaire impossible (conflit)");
            }
        }
    };

    const handleSave = () => {
        if (!error) {
            onSave(currentValidDate.toISOString());
        }
    };

    // Calculate day shift label relative to ORIGINAL
    // If originalDate is today, and we shift to tomorrow => J+1
    const dayShift = Math.floor((currentValidDate.getTime() - anchorTimeMs) / (24 * 60 * 60 * 1000));
    let shiftLabel = "";

    // Compare dates (day/month)
    const isSameDayAsOriginal = currentValidDate.getDate() === originalDate.getDate() && currentValidDate.getMonth() === originalDate.getMonth();

    if (!isSameDayAsOriginal) {
        if (currentValidDate > originalDate) shiftLabel = "(J+1)";
        else if (currentValidDate < originalDate) shiftLabel = "(J-1)";
    }

    return (
        <div className="bg-white rounded-xl border-2 border-indigo-500 shadow-lg p-3 animate-in zoom-in-95 relative z-20 w-full mb-2">

            {/* Detailed Header */}
            <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
                {/* 1. Heure Programmée (Original) */}
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Programmée</span>
                    <div className="flex items-center gap-1.5 opacity-60">
                        <div className="text-xs text-slate-500 line-through font-mono font-medium">
                            {dose.originalTime || originalDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>

                <div className="h-6 w-px bg-slate-200 mx-2"></div>

                {/* 2. Heure Actuelle (Current Saved) */}
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wide">Actuelle</span>
                    <div className="text-xs text-indigo-600 font-bold font-mono">
                        {dose.time}
                    </div>
                </div>

                <div className="flex-1"></div>

                {/* 3. Nouvelle Heure (Draft) */}
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide mb-0.5">Nouvelle</span>
                    <div className="flex items-center gap-2">
                        {shiftLabel && <span className="text-[10px] font-bold text-indigo-400 bg-indigo-50 px-1 rounded">{shiftLabel}</span>}
                        <div className="relative">
                            <input
                                type="time"
                                value={rawInput}
                                onChange={handleTimeInput}
                                className="bg-white border border-indigo-200 rounded px-1 text-sm font-bold text-indigo-700 outline-none w-[4.5rem] text-center font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-all [&::-webkit-calendar-picker-indicator]:hidden"
                            />
                        </div>
                    </div>
                </div>
            </div>


            {/* Long Slider Row */}
            <div className="relative h-12 flex items-center px-2 mb-2">
                {/* Track Background */}
                <div className="absolute left-0 right-0 h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    {/* Center Marker (Original Time) */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400 z-0 opacity-30"></div>

                    {/* Active Progress form Center (Where Center = Anchor/Original) */}
                    <div
                        className="absolute top-0 bottom-0 bg-indigo-100 transition-all duration-75"
                        style={{
                            left: sliderValue < 0 ? `${(sliderValue + 100) / 2}%` : '50%',
                            right: sliderValue > 0 ? `${100 - ((sliderValue + 100) / 2)}%` : '50%'
                        }}
                    />
                </div>

                <input
                    type="range"
                    min="-100"
                    max="100"
                    value={sliderValue}
                    onChange={handleSliderChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
                />

                {/* Thumb Visual */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-md border-2 border-indigo-600 flex items-center justify-center pointer-events-none transition-all duration-75 z-20 group"
                    style={{ left: `${(sliderValue + 100) / 2}%`, transform: 'translate(-50%, -50%)' }}
                >
                    <div className="w-1.5 h-3 bg-indigo-500 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                </div>
            </div>

            {/* Footer / Actions */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex-1">
                    {error && (
                        <div className="flex items-center gap-1.5 text-xs text-red-600 font-bold animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    >
                        Annuler
                    </button>
                    <button
                        disabled={!!error}
                        onClick={handleSave}
                        className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <Check className="w-3.5 h-3.5" />
                        Valider
                    </button>
                </div>
            </div>
        </div>
    );
};
