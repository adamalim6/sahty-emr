import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Clock } from 'lucide-react';
import { durationToDecimal } from './utils';

interface DoseEditorProps {
    dose: { date: Date; time: string; id: string };
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
    // Min Start: Prev End + Buffer
    // Max Start: Next Start - Dose Duration - Buffer
    const minStartMs = prevDoseEnd.getTime() + BUFFER_MS;
    const maxStartMs = nextDoseStart.getTime() - currentDoseDurationMs - BUFFER_MS;

    const doseStart = dose.date.getTime();

    // We allow editing logic relative to CURRENT dose time, clamped by bounds.

    const [sliderValue, setSliderValue] = useState(0); // -100 to 100
    const [rawInput, setRawInput] = useState(dose.time);
    const [error, setError] = useState<string | null>(null);
    const [currentValidDate, setCurrentValidDate] = useState<Date>(dose.date);

    // Max deltas in MS
    const maxPosDelta = Math.max(0, maxStartMs - doseStart);
    const maxNegDelta = Math.max(0, doseStart - minStartMs);

    // Effect: Handle slider changes
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);

        let deltaMs = 0;
        if (val > 0) {
            deltaMs = maxPosDelta * Math.pow(val / 100, 3);
        } else {
            deltaMs = -maxNegDelta * Math.pow(Math.abs(val) / 100, 3);
        }

        const newTimeMs = doseStart + deltaMs;

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

                // Reverse calc slider
                const diff = best.getTime() - doseStart;
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

    // Calculate day shift label
    const dayShift = Math.floor((currentValidDate.getTime() - doseStart) / (24 * 60 * 60 * 1000));
    let shiftLabel = "";
    const sameDay = currentValidDate.getDate() === dose.date.getDate() && currentValidDate.getMonth() === dose.date.getMonth();

    if (!sameDay) {
        if (currentValidDate > dose.date) shiftLabel = "(J+1)";
        else if (currentValidDate < dose.date) shiftLabel = "(J-1)";
    }

    return (
        <div className="bg-white rounded-xl border-2 border-indigo-500 shadow-lg p-2 animate-in zoom-in-95 relative z-20 w-full mb-2">
            <div className="flex flex-col gap-4 p-2">
                {/* Header & Inputs Row */}
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-xs font-bold text-indigo-600 uppercase mb-1">Modifier l'horaire</h4>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-400" />
                            <div className="text-xs text-slate-400 line-through font-mono">{dose.time}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                        {shiftLabel && <span className="text-xs font-bold text-indigo-500">{shiftLabel}</span>}
                        <input
                            type="time"
                            value={rawInput}
                            onChange={handleTimeInput}
                            className="bg-transparent text-xl font-bold text-indigo-700 outline-none w-20 text-center font-mono [&::-webkit-calendar-picker-indicator]:hidden"
                        />
                    </div>
                </div>

                {/* Long Slider Row */}
                <div className="relative h-12 flex items-center px-2">
                    {/* Track Background */}
                    <div className="absolute left-0 right-0 h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        {/* Center Marker */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-300 z-0"></div>
                        {/* Active Progress (Optional, purely visual relative from center) */}
                        <div
                            className="absolute top-0 bottom-0 bg-indigo-100/50 transition-all duration-75"
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
                        className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-md border-2 border-indigo-600 flex items-center justify-center pointer-events-none transition-all duration-75 z-20"
                        style={{ left: `${(sliderValue + 100) / 2}%`, transform: 'translate(-50%, -50%)' }}
                    >
                        <div className="w-1.5 h-3 bg-indigo-500 rounded-full opacity-50"></div>
                    </div>
                </div>

                {/* Footer / Actions */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <div className="flex-1">
                        {error ? (
                            <div className="flex items-center gap-1.5 text-xs text-red-600 font-bold animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{error}</span>
                            </div>
                        ) : (
                            <span className="text-xs text-slate-400">Glissez ou saisissez l'heure</span>
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
        </div>
    );
};
