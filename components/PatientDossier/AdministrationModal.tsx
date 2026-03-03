import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

export type AdminModalActionType = 'administered' | 'refused' | 'started' | 'ended';

export interface AdministrationSavePayload {
    action_type: AdminModalActionType;
    occurred_at: string;
    actual_start_at: string | null;
    actual_end_at: string | null;
    justification?: string;
    // Note: status, linked_event_id, etc. are returned by the backend but not sent on native save directly
}

interface AdministrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (payload: AdministrationSavePayload | AdministrationSavePayload[]) => void;
    onCancelEvent: (adminEventId: string, reason?: string) => void;
    prescriptionName: string;
    slotTime: string; // ISO string of the scheduled_at anchor
    duration: number; // 0 = instant, >0 = perfusion
    activePerfusionEvent: any | null; // If a perfusion is currently running
    historyEvents: any[]; // The events for this specific slot
}

export const AdministrationModal: React.FC<AdministrationModalProps> = ({
    isOpen, onClose, onSave, onCancelEvent, prescriptionName, slotTime, duration, activePerfusionEvent, historyEvents
}) => {
    const isPerfusion = duration > 0;
    const isPerfusionStarted = !!activePerfusionEvent;

    const [tacheEffectuee, setTacheEffectuee] = useState<'OUI' | 'NON'>('OUI');
    const [motif, setMotif] = useState('');
    
    // Slider state
    const [sliderOffsetMin, setSliderOffsetMin] = useState<number>(0);
    // For perfusions, if they are ending it, we need an offset for the end time.
    // If they are starting it, the slider is for the start time.
    const [sliderEndOffsetMin, setSliderEndOffsetMin] = useState<number>(0);
    const [logEndSimultaneously, setLogEndSimultaneously] = useState<boolean>(false);
    const [showCancelled, setShowCancelled] = useState<boolean>(false);

    useEffect(() => {
        if (isOpen) {
            setTacheEffectuee('OUI');
            setMotif('');
            setLogEndSimultaneously(false);
            const nowTs = Date.now();
            const schedTs = new Date(slotTime).getTime();
            const expectedEndTs = schedTs + (duration * 60000);
            
            const dynamicMaxStartOffset = Math.floor((nowTs - schedTs) / 60000);
            const dynamicMaxEndOffset = Math.floor((nowTs - expectedEndTs) / 60000);
            
            // Default start offset: 0 (scheduled_at), bounded by now and -48h
            let defaultStartOffset = 0;
            if (defaultStartOffset > dynamicMaxStartOffset) defaultStartOffset = dynamicMaxStartOffset;
            if (defaultStartOffset < -2880) defaultStartOffset = -2880;

            // Find Active Events from History payload
            const activeStart = historyEvents.find(e => e.action_type === 'started' && e.status !== 'CANCELLED');
            const activeEnd = historyEvents.find(e => e.action_type === 'ended' && e.status !== 'CANCELLED');
            const activeAdmin = historyEvents.find(e => e.action_type === 'administered' && e.status !== 'CANCELLED');
            const activeRefused = historyEvents.find(e => e.action_type === 'refused' && e.status !== 'CANCELLED');

            if (!isPerfusion) {
                if (activeAdmin || activeRefused) {
                    const activeTs = new Date((activeAdmin || activeRefused)?.actual_start_at || (activeAdmin || activeRefused)?.occurred_at || nowTs).getTime();
                    let actualOffset = Math.round((activeTs - schedTs) / 60000);
                    if (actualOffset < -2880) actualOffset = -2880;
                    if (actualOffset > dynamicMaxStartOffset) actualOffset = dynamicMaxStartOffset;
                    setSliderOffsetMin(actualOffset);
                } else {
                    setSliderOffsetMin(defaultStartOffset);
                }
            } else {
                if (activeStart) {
                    // Start offset is whatever the actual start was relative to schedTs
                    const activeStartTs = new Date(activeStart.actual_start_at || activeStart.occurred_at).getTime();
                    let actualStartOffset = Math.round((activeStartTs - schedTs) / 60000);
                    if (actualStartOffset < -2880) actualStartOffset = -2880;
                    if (actualStartOffset > dynamicMaxStartOffset) actualStartOffset = dynamicMaxStartOffset;
                    setSliderOffsetMin(actualStartOffset); // lock start visually

                    if (activeEnd) {
                        const activeEndTs = new Date(activeEnd.actual_end_at || activeEnd.occurred_at).getTime();
                        let actualEndOffset = Math.round((activeEndTs - expectedEndTs) / 60000);
                        if (actualEndOffset < -2880) actualEndOffset = -2880;
                        if (actualEndOffset > dynamicMaxEndOffset) actualEndOffset = dynamicMaxEndOffset;
                        setSliderEndOffsetMin(actualEndOffset);
                        setLogEndSimultaneously(true); // if it has an active end, the user sees both sliders
                    } else {
                        let defaultEndOffset = 0; 
                        if (defaultEndOffset > dynamicMaxEndOffset) defaultEndOffset = dynamicMaxEndOffset;
                        
                        // End time min bound relative to actual start
                        const minAllowedEndOffset = Math.ceil((activeStartTs - expectedEndTs) / 60000);
                        if (defaultEndOffset < minAllowedEndOffset) defaultEndOffset = minAllowedEndOffset;
                        if (defaultEndOffset > dynamicMaxEndOffset) defaultEndOffset = dynamicMaxEndOffset;
                        if (defaultEndOffset < -2880) defaultEndOffset = -2880;

                        setSliderEndOffsetMin(defaultEndOffset);
                    }
                } else if (activeRefused) {
                    const activeTs = new Date(activeRefused.occurred_at || nowTs).getTime();
                    let actualOffset = Math.round((activeTs - schedTs) / 60000);
                    if (actualOffset < -2880) actualOffset = -2880;
                    if (actualOffset > dynamicMaxStartOffset) actualOffset = dynamicMaxStartOffset;
                    setSliderOffsetMin(actualOffset);
                    let defaultEndOffset = 0;
                    if (defaultEndOffset > dynamicMaxEndOffset) defaultEndOffset = dynamicMaxEndOffset;
                    if (defaultEndOffset < -2880) defaultEndOffset = -2880;
                    setSliderEndOffsetMin(defaultEndOffset);
                } else {
                    setSliderOffsetMin(defaultStartOffset);
                    let defaultEndOffset = 0;
                    if (defaultEndOffset > dynamicMaxEndOffset) defaultEndOffset = dynamicMaxEndOffset;
                    if (defaultEndOffset < -2880) defaultEndOffset = -2880;
                    setSliderEndOffsetMin(defaultEndOffset);
                }
            }
        }
    }, [isOpen, slotTime, duration, isPerfusionStarted, activePerfusionEvent, isPerfusion]);

    if (!isOpen) return null;

    // Formatting for Header
    const schedDateObj = new Date(slotTime);
    const schedDateStr = schedDateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const schedTimeStr = schedDateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    let headerText = '';
    if (!isPerfusion) {
        headerText = `à administrer le ${schedDateStr} à ${schedTimeStr}`;
    } else {
        const expectedEndObj = new Date(schedDateObj.getTime() + duration * 60000);
        const expectedEndTimeStr = expectedEndObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const h = Math.floor(duration / 60);
        const m = duration % 60;
        const durStr = `+${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
        
        headerText = `à commencer le ${schedDateStr} à ${schedTimeStr}\narrêter le ${schedDateStr} à ${expectedEndTimeStr} (${durStr})`;
    }
    const expectedEndDateObj = new Date(schedDateObj.getTime() + duration * 60000);
    
    // Slider bounds
    const nowTs = Date.now();
    const MIN_OFFSET = -2880; // -48 hours (fixed visual bounds)
    const MAX_OFFSET = 2880;  // +48 hours (fixed visual bounds)
    
    const dynamicMaxStartOffset = Math.floor((nowTs - schedDateObj.getTime()) / 60000);
    const dynamicMaxEndOffset = Math.floor((nowTs - expectedEndDateObj.getTime()) / 60000);
    
    // Derived Date logic
    const getStartSliderDate = (offsetMins: number) => new Date(schedDateObj.getTime() + offsetMins * 60000);
    const getEndSliderDate = (offsetMins: number) => new Date(expectedEndDateObj.getTime() + offsetMins * 60000);
    const selectedStartObj = getStartSliderDate(sliderOffsetMin);
    const selectedEndObj = getEndSliderDate(sliderEndOffsetMin);

    const toDatetimeLocal = (d: Date) => {
        const tzOffsetMs = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
    };

    const handleStartDatetimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) return;
        const newTs = new Date(e.target.value).getTime();
        if (isNaN(newTs)) return;
        let offsetMins = Math.round((newTs - schedDateObj.getTime()) / 60000);
        if (offsetMins < MIN_OFFSET) offsetMins = MIN_OFFSET;
        if (offsetMins > dynamicMaxStartOffset) offsetMins = dynamicMaxStartOffset;
        setSliderOffsetMin(offsetMins);
    };

    const handleEndDatetimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) return;
        const newTs = new Date(e.target.value).getTime();
        if (isNaN(newTs)) return;
        let offsetMins = Math.round((newTs - expectedEndDateObj.getTime()) / 60000);
        if (offsetMins < MIN_OFFSET) offsetMins = MIN_OFFSET;
        if (offsetMins > dynamicMaxEndOffset) offsetMins = dynamicMaxEndOffset;
        setSliderEndOffsetMin(offsetMins);
    };

    const adjustStart = (deltaMins: number) => {
        setSliderOffsetMin(prev => {
            let val = prev + deltaMins;
            if (val < MIN_OFFSET) val = MIN_OFFSET;
            if (val > dynamicMaxStartOffset) val = dynamicMaxStartOffset;
            return val;
        });
    };

    const adjustEnd = (deltaMins: number) => {
        setSliderEndOffsetMin(prev => {
            let val = prev + deltaMins;
            if (val < MIN_OFFSET) val = MIN_OFFSET;
            if (val > dynamicMaxEndOffset) val = dynamicMaxEndOffset;
            return val;
        });
    };

    const validateForm = () => {
        if (selectedStartObj.getTime() > nowTs) return "L'administration ne peut pas être enregistrée dans le futur.";
        if (selectedEndObj.getTime() > nowTs && (isPerfusionStarted || logEndSimultaneously)) return "La fin ne peut pas être enregistrée dans le futur.";

        if (isPerfusion && isPerfusionStarted && tacheEffectuee === 'OUI') {
            if (selectedEndObj.getTime() < selectedStartObj.getTime()) return "La fin ne peut pas précéder le début.";
        }
        if (isPerfusion && !isPerfusionStarted && logEndSimultaneously && tacheEffectuee === 'OUI') {
            if (selectedEndObj.getTime() < selectedStartObj.getTime()) return "La fin ne peut pas précéder le début.";
        }
        if (tacheEffectuee === 'NON' && !motif.trim()) return "Un motif de refus est obligatoire.";
        
        return null;
    };

    const errorMsg = validateForm();

    const handleSave = () => {
        if (errorMsg) {
            alert(errorMsg);
            return;
        }

        if (!isPerfusion) {
            // Bolus
            const payload: AdministrationSavePayload = {
                action_type: tacheEffectuee === 'OUI' ? 'administered' : 'refused',
                occurred_at: new Date().toISOString(),
                actual_start_at: selectedStartObj.toISOString(),
                actual_end_at: null,
                justification: tacheEffectuee === 'NON' ? motif : undefined
            };
            onSave(payload);
        } else {
            // Perfusion
            if (tacheEffectuee === 'NON') {
                const payload: AdministrationSavePayload = {
                    action_type: 'refused',
                    occurred_at: new Date().toISOString(),
                    actual_start_at: null,
                    actual_end_at: null,
                    justification: motif
                };
                onSave(payload);
                return;
            }

            // OUI logic for Perfusion
            if (!isPerfusionStarted) {
                // Initial START log
                const payloads: AdministrationSavePayload[] = [{
                    action_type: 'started',
                    occurred_at: new Date().toISOString(),
                    actual_start_at: selectedStartObj.toISOString(),
                    actual_end_at: null
                }];
                if (logEndSimultaneously) {
                    payloads.push({
                        action_type: 'ended',
                        occurred_at: new Date().toISOString(),
                        actual_start_at: selectedStartObj.toISOString(),
                        actual_end_at: selectedEndObj.toISOString()
                    });
                }
                onSave(payloads);
            } else {
                // Already started, ending now
                const payload: AdministrationSavePayload = {
                    action_type: 'ended',
                    occurred_at: new Date().toISOString(),
                    actual_start_at: selectedStartObj.toISOString(), // the mapped locked start
                    actual_end_at: selectedEndObj.toISOString()
                };
                onSave(payload);
            }
        }
    };

    const onCancelClick = (eventId: string) => {
        const reason = window.prompt("Motif d'annulation (Optionnel) :");
        if (reason !== null) {
            onCancelEvent(eventId, reason);
        }
    };

    // --- History Grouping Logic ---
    const filteredHistory = (historyEvents || []).filter(ev => showCancelled || ev.status !== 'CANCELLED');
    const sortedHistory = [...filteredHistory].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    
    type HistoryBlock = {
        type: 'standalone';
        event: any;
        latestTs: number;
    } | {
        type: 'group';
        id: string;
        start?: any;
        end?: any;
        latestTs: number;
    };

    const groupedBlocksMap = new Map<string, HistoryBlock>();

    sortedHistory.forEach(ev => {
        const ts = new Date(ev.occurred_at).getTime();
        if (ev.linked_event_id) {
            if (!groupedBlocksMap.has(ev.linked_event_id)) {
                groupedBlocksMap.set(ev.linked_event_id, { type: 'group', id: ev.linked_event_id, latestTs: ts });
            }
            const group = groupedBlocksMap.get(ev.linked_event_id)! as any;
            if (ev.action_type === 'started') group.start = ev;
            if (ev.action_type === 'ended') group.end = ev;
            if (ts > group.latestTs) group.latestTs = ts;
        } else {
            groupedBlocksMap.set(ev.id, { type: 'standalone', event: ev, latestTs: ts });
        }
    });

    const blocksArray = Array.from(groupedBlocksMap.values()).sort((a, b) => b.latestTs - a.latestTs);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 shadow-lg backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="bg-[#EDEDED] rounded-xl overflow-hidden shadow-2xl w-full max-w-[1000px] max-h-[95vh] flex flex-col relative text-gray-800 font-sans">
                {/* Close Button X absolute over header */}
                <button onClick={onClose} className="absolute right-4 top-4 text-white hover:text-gray-200 bg-white/20 p-1 rounded-full z-10 transition-colors">
                    <X size={20} />
                </button>

                {/* Blue Header */}
                <div className="bg-[#4B7BFF] flex-shrink-0 px-8 py-5 text-white shadow-md z-1 relative">
                    <h2 className="text-xl font-bold whitespace-pre-line leading-snug tracking-wide">
                        {prescriptionName}
                    </h2>
                    <p className="text-white/80 mt-1 font-medium">{headerText}</p>
                </div>

                <div className="flex w-full min-h-[450px] overflow-hidden relative">
                    {/* Left Pane - Nouvel événement */}
                    <div className="w-[55%] p-8 border-r-2 border-gray-300 flex flex-col overflow-y-auto custom-scrollbar">
                        <h3 className="font-bold text-xl mb-6 text-black border-b border-gray-300 pb-2">Nouvel événement</h3>

                        <div className="space-y-8 flex-1">
                            {/* Toggle OUI / NON */}
                            <div className="flex items-center space-x-6">
                                <span className="font-semibold text-gray-700 w-[140px] uppercase text-sm tracking-wider">Tâche effectuée</span>
                                <div className="flex rounded-md overflow-hidden bg-gray-200 border-2 border-transparent focus-within:border-gray-300 shadow-inner">
                                    <button 
                                        className={`px-8 py-2 font-bold transition-all duration-200 ${tacheEffectuee === 'OUI' ? 'bg-white text-[#4B7BFF] shadow-sm transform scale-[1.02]' : 'bg-transparent text-gray-500 hover:bg-gray-300'}`}
                                        onClick={() => setTacheEffectuee('OUI')}
                                    >
                                        OUI
                                    </button>
                                    <button 
                                        className={`px-8 py-2 font-bold transition-all duration-200 ${tacheEffectuee === 'NON' ? 'bg-white text-red-600 shadow-sm transform scale-[1.02]' : 'bg-transparent text-gray-500 hover:bg-gray-300'}`}
                                        onClick={() => setTacheEffectuee('NON')}
                                    >
                                        NON
                                    </button>
                                </div>
                            </div>

                            {/* Toggle logEndSimultaneously (for non-started perfusions) */}
                            {tacheEffectuee === 'OUI' && isPerfusion && !isPerfusionStarted && (
                                <div className="flex items-center space-x-3 mt-4">
                                    <input 
                                        type="checkbox" 
                                        id="logEndSimultaneously" 
                                        checked={logEndSimultaneously} 
                                        onChange={(e) => setLogEndSimultaneously(e.target.checked)}
                                        className="w-4 h-4 text-[#4B7BFF] bg-gray-100 border-gray-300 rounded focus:ring-[#4B7BFF] focus:ring-2"
                                    />
                                    <label htmlFor="logEndSimultaneously" className="font-semibold text-gray-700 text-sm cursor-pointer">
                                        Enregistrer la fin de la perfusion en même temps
                                    </label>
                                </div>
                            )}

                            {tacheEffectuee === 'OUI' && (
                                <div className="space-y-6 pt-2">
                                    {/* Slider Header Visuals */}
                                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-in slide-in-from-bottom-2 fade-in">
                                        
                                        {/* START SLIDER BLOCK */}
                                        {(!isPerfusion || !isPerfusionStarted) && (
                                            <div className="mb-2">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="font-semibold text-gray-700 uppercase tracking-widest text-[11px]">
                                                        {isPerfusion ? "Ajustement Début (±48h)" : "Ajustement Date / Heure (±48h)"}
                                                    </span>
                                                    <input 
                                                        type="datetime-local" 
                                                        value={toDatetimeLocal(selectedStartObj)}
                                                        onChange={handleStartDatetimeChange}
                                                        className="text-sm font-bold text-[#4B7BFF] bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 outline-none focus:ring-2 focus:ring-blue-400 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden text-center"
                                                        style={{ appearance: 'none', WebkitAppearance: 'none' }}
                                                    />
                                                </div>
                                                <div className="relative pt-2 pb-2">
                                                    <input 
                                                        type="range" 
                                                        min={MIN_OFFSET} 
                                                        max={MAX_OFFSET} 
                                                        step={5} 
                                                        value={sliderOffsetMin}
                                                        onChange={(e) => {
                                                            let val = parseInt(e.target.value, 10);
                                                            if (val > dynamicMaxStartOffset) val = dynamicMaxStartOffset;
                                                            setSliderOffsetMin(val);
                                                        }}
                                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4B7BFF]"
                                                    />
                                                    <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase mt-2 px-1">
                                                        <span>-48h</span>
                                                        <span>Prévu (0)</span>
                                                        <span>+48h</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                                                    <button type="button" onClick={() => adjustStart(-60)} className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">-1h</button>
                                                    <button type="button" onClick={() => adjustStart(-15)} className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">-15m</button>
                                                    <button type="button" onClick={() => setSliderOffsetMin(0)} className="px-3 py-1 text-xs font-bold bg-[#4B7BFF]/10 text-[#4B7BFF] rounded hover:bg-[#4B7BFF]/20 transition-colors">Prévu</button>
                                                    <button type="button" onClick={() => setSliderOffsetMin(dynamicMaxStartOffset)} className="px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors">Maintenant</button>
                                                    <button type="button" onClick={() => adjustStart(15)} className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">+15m</button>
                                                    <button type="button" onClick={() => adjustStart(60)} className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">+1h</button>
                                                </div>
                                            </div>
                                        )}

                                        {/* END SLIDER BLOCK */}
                                        {isPerfusion && (isPerfusionStarted || logEndSimultaneously) && (
                                            <div className={`${(!isPerfusionStarted) ? 'border-t border-gray-100 pt-6 mt-4' : 'mb-2'}`}>
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="font-semibold text-gray-700 uppercase tracking-widest text-[11px]">Ajustement Fin (±48h)</span>
                                                    <input 
                                                        type="datetime-local" 
                                                        value={toDatetimeLocal(selectedEndObj)}
                                                        onChange={handleEndDatetimeChange}
                                                        className="text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-md border border-orange-200 outline-none focus:ring-2 focus:ring-orange-400 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden text-center"
                                                        style={{ appearance: 'none', WebkitAppearance: 'none' }}
                                                    />
                                                </div>
                                                <div className="relative pt-2 pb-2">
                                                    <input 
                                                        type="range" 
                                                        min={MIN_OFFSET} 
                                                        max={MAX_OFFSET} 
                                                        step={5} 
                                                        value={sliderEndOffsetMin}
                                                        onChange={(e) => {
                                                            let val = parseInt(e.target.value, 10);
                                                            if (val > dynamicMaxEndOffset) val = dynamicMaxEndOffset;
                                                            setSliderEndOffsetMin(val);
                                                        }}
                                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                                    />
                                                    <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase mt-2 px-1">
                                                        <span>-48h</span>
                                                        <span>Fin Prévue (0)</span>
                                                        <span>+48h</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                                                    <button type="button" onClick={() => adjustEnd(-60)} className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">-1h</button>
                                                    <button type="button" onClick={() => adjustEnd(-15)} className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">-15m</button>
                                                    <button type="button" onClick={() => setSliderEndOffsetMin(0)} className="px-3 py-1 text-xs font-bold bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors">Prévu</button>
                                                    <button type="button" onClick={() => setSliderEndOffsetMin(dynamicMaxEndOffset)} className="px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors">Maintenant</button>
                                                    <button type="button" onClick={() => adjustEnd(15)} className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">+15m</button>
                                                    <button type="button" onClick={() => adjustEnd(60)} className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">+1h</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Motif de refus / note facultative */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className={`font-semibold text-sm uppercase tracking-wider ${tacheEffectuee === 'NON' ? 'text-red-600' : 'text-gray-500'}`}>
                                        {tacheEffectuee === 'NON' ? 'Motif de refus *' : 'Note (Optionnel)'}
                                    </span>
                                    {motif && (
                                        <button 
                                            type="button" 
                                            onClick={() => setMotif('')}
                                            className="text-xs text-gray-400 hover:text-gray-700 font-bold transition-colors uppercase tracking-wider flex items-center"
                                        >
                                            <X size={12} className="mr-1" /> Effacer
                                        </button>
                                    )}
                                </div>
                                <textarea 
                                    value={motif}
                                    onChange={(e) => setMotif(e.target.value)}
                                    className={`w-full p-3 rounded-lg border bg-white focus:ring-2 outline-none transition-all shadow-sm resize-none h-[80px] ${tacheEffectuee === 'NON' ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-[#4B7BFF]'}`}
                                    placeholder={tacheEffectuee === 'NON' ? "Pourquoi la tâche n'a-t-elle pas été effectuée ?" : "Ajouter une note clinique..."}
                                />
                                {tacheEffectuee === 'NON' && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {["Rejet Patient", "Délai Pharmacie", "Patient Absent"].map(pill => (
                                            <button
                                                key={pill}
                                                type="button"
                                                onClick={() => setMotif(motif ? `${motif} - ${pill}` : pill)}
                                                className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-full text-xs font-bold transition-colors"
                                            >
                                                {pill}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="mt-4 flex flex-shrink-0 items-center text-red-600 text-sm font-semibold p-3 bg-red-100 rounded-md shadow-sm border border-red-200">
                                <AlertCircle size={16} className="mr-2" />
                                {errorMsg}
                            </div>
                        )}
                        
                    </div>

                    {/* Right Pane - Historique */}
                    <div className="w-[45%] p-8 bg-[#EAEAEA] relative flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-2">
                            <h3 className="font-bold text-xl text-black">Historique</h3>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <span className="text-xs font-semibold text-gray-500">Voir annulé(s)</span>
                                <input 
                                    type="checkbox" 
                                    className="rounded text-[#4B7BFF] focus:ring-[#4B7BFF] h-4 w-4 border-gray-300" 
                                    checked={showCancelled}
                                    onChange={(e) => setShowCancelled(e.target.checked)}
                                />
                            </label>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            {sortedHistory.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-400 italic">
                                    Aucun événement enregistré.
                                </div>
                            ) : (
                                <>
                                    {blocksArray.map((block, idx) => {
                                        if (block.type === 'standalone') {
                                            return <HistoryItem key={block.event.id} ev={block.event} onCancel={() => onCancelClick(block.event.id)} />;
                                        } else {
                                            const group = block as any;
                                            return (
                                                <div key={`perf-group-${idx}`} className="bg-gray-300/50 p-3 rounded-lg border border-gray-300 relative">
                                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mr-2"></div>
                                                        Groupe Perfusion
                                                    </div>
                                                    <div className="space-y-2 relative pl-4 border-l-2 border-gray-400/30 ml-2">
                                                        {group.end && <HistoryItem ev={group.end} onCancel={() => onCancelClick(group.end.id)} />}
                                                        {group.start && <HistoryItem ev={group.start} onCancel={() => onCancelClick(group.start.id)} />}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="bg-gray-200 p-5 flex flex-shrink-0 justify-end space-x-4 border-t border-gray-300">
                    <button 
                        onClick={onClose}
                        className="bg-white hover:bg-gray-100 text-gray-600 font-bold rounded-lg px-8 py-2.5 transition-colors border border-gray-300 shadow-sm"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={!!errorMsg}
                        className="bg-[#00CC66] hover:bg-emerald-600 text-white font-bold rounded-lg px-12 py-2.5 transition-all shadow-md focus:ring-4 focus:ring-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        <Check size={18} className="mr-2" />
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
};

// -- Helper Component for History Item --
const HistoryItem = ({ ev, onCancel }: { ev: any, onCancel: () => void }) => {
    const isCancelled = ev.status === 'CANCELLED';
    
    const actionLabels: Record<string, string> = {
        administered: 'Administré',
        refused: 'Refusé',
        started: 'Début',
        ended: 'Fin',
        'PERFUSION_START': 'Début Perfusion',
        'PERFUSION_END': 'Fin Perfusion'
    };
    
    const label = actionLabels[ev.action_type] || ev.action_type;
    const isError = ev.action_type === 'refused' || isCancelled;
    
    const targetAt = ev.actual_start_at || ev.actual_end_at || ev.occurred_at;
    let actionAt = ev.occurred_at;
    if (ev.action_type === 'ended' || ev.action_type === 'PERFUSION_END') {
        actionAt = ev.actual_end_at || ev.occurred_at;
    } else if (ev.action_type === 'started' || ev.action_type === 'PERFUSION_START' || ev.action_type === 'administered') {
        actionAt = ev.actual_start_at || ev.occurred_at;
    }

    const actionD = new Date(actionAt);
    const dateStr = !isNaN(actionD.getTime()) ? actionD.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';
    const timeStr = !isNaN(actionD.getTime()) ? actionD.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    
    // "enregistré à" strictly follows occurred_at which is the frontend payload submission time
    const recordedD = new Date(ev.occurred_at);
    const recordedTimeStr = !isNaN(recordedD.getTime()) ? recordedD.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    
    return (
        <div className={`rounded-md p-3 flex flex-col space-y-1 relative shadow-sm border border-transparent transition-all overflow-hidden ${isCancelled ? 'bg-gray-200 opacity-60' : 'bg-white hover:border-gray-300'}`}>
            <div className={`flex justify-between items-center ${isCancelled ? 'text-gray-500' : 'text-gray-800'}`}>
                <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${isError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                    <span className={`font-bold text-sm ${isCancelled ? 'line-through' : ''}`}>{label}</span>
                    {isCancelled && (
                        <span className="text-[9px] font-bold text-red-600 uppercase border border-red-500 rounded bg-red-50 px-1 py-0.5 ml-1 leading-none shadow-sm">
                            Annulé
                        </span>
                    )}
                </div>
                <span className={`font-mono text-xs font-semibold ${isCancelled ? 'line-through' : ''}`}>{dateStr} à {timeStr}</span>
            </div>
            
            {(ev.justification || ev.note || ev.cancellation_reason) && (
                <div className={`text-xs p-1.5 rounded mt-1 shadow-inner ${isCancelled ? 'bg-gray-300/50 text-gray-600 line-through' : 'bg-orange-50 text-orange-800 border-l-2 border-orange-300'}`}>
                    {ev.cancellation_reason ? `Motif annulation: ${ev.cancellation_reason}` : (ev.note || ev.justification)}
                </div>
            )}
            
            {!isCancelled && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                    <button 
                        onClick={onCancel}
                        className="text-[10px] text-red-500 font-bold uppercase tracking-wider hover:underline flex items-center"
                    >
                        <X size={10} className="mr-1" /> Annuler l'événement
                    </button>
                    <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] font-bold text-gray-600 capitalize">
                            {ev.performed_by_first_name} {ev.performed_by_last_name}
                        </span>
                        <span className="text-[9px] text-gray-400 italic mt-0.5">
                            enregistré à {recordedTimeStr}
                        </span>
                    </div>
                </div>
            )}
            
            {isCancelled && (
                <div className="flex justify-end items-center mt-2 pt-2 border-t border-gray-300">
                    <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] font-bold text-gray-500 capitalize">
                            {ev.performed_by_first_name} {ev.performed_by_last_name}
                        </span>
                        <span className="text-[9px] text-gray-400 italic mt-0.5">
                            enregistré à {recordedTimeStr}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
