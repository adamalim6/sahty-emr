import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

export type AdminModalActionType = 'administered' | 'refused' | 'started' | 'ended';

export interface AdministrationSavePayload {
    action_type: AdminModalActionType;
    occurred_at: string;
    actual_start_at: string | null;
    actual_end_at: string | null;
    justification?: string;
    transfusion?: {
        bloodBagIds: string[];
        checks: {
            identity_check_done: boolean;
            compatibility_check_done: boolean;
            bedside_double_check_done: boolean;
            vitals_baseline_done: boolean;
            notes?: string;
        };
        reaction?: {
            reaction_present: boolean;
            reaction_type?: string;
            severity?: string;
            description?: string;
            actions_taken?: string;
        };
    };
    administered_bags?: { id: string, volume_ml: number }[];
    linked_event_id?: string;
    volume_administered_ml?: number | null;
}

interface AdministrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (payload: AdministrationSavePayload | AdministrationSavePayload[]) => void;
    onCancelEvent: (adminEventId: string, reason?: string) => void;
    prescriptionName: string;
    slotTime: string; // ISO string of the scheduled_at anchor
    duration: number; // 0 = instant, >0 = perfusion
    requiresEndEvent: boolean; // TRUE = shows the second slider for end time
    activePerfusionEvent: any | null; // If a perfusion is currently running
    historyEvents: any[]; // The events for this specific slot
    isTransfusion?: boolean;
    availableBags?: any[];
    eventId?: string;
    requiresFluidInfo?: boolean;
}

export const AdministrationModal: React.FC<AdministrationModalProps> = ({
    isOpen, onClose, onSave, onCancelEvent, prescriptionName, slotTime, duration, requiresEndEvent, activePerfusionEvent, historyEvents, isTransfusion = false, availableBags = [], eventId, requiresFluidInfo = false
}) => {
    const isPerfusion = requiresEndEvent;
    const isPerfusionStarted = !!activePerfusionEvent;

    const [tacheEffectuee, setTacheEffectuee] = useState<'OUI' | 'NON'>('OUI');
    const [motif, setMotif] = useState('');
    const [administeredVolume, setAdministeredVolume] = useState<number | ''>('');
    
    // Transfusion States
    const [selectedBags, setSelectedBags] = useState<string[]>([]);
    const [bagVolumes, setBagVolumes] = useState<Record<string, number>>({});
    
    const [checks, setChecks] = useState({
        identity: false,
        compatibility: false,
        bedside: false,
        vitals: false
    });

    const [reaction, setReaction] = useState({
        present: false,
        type: '',
        notes: ''
    });

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
            setAdministeredVolume('');
            setLogEndSimultaneously(false);
            setSelectedBags([]);
            setBagVolumes({});
            setChecks({ identity: false, compatibility: false, bedside: false, vitals: false });
            setReaction({ present: false, type: '', notes: '' });
            const nowTs = Date.now();
            const schedTs = new Date(slotTime).getTime();
            const expectedEndTs = schedTs + (duration * 60000);
            
            let dynamicMaxStartOffset = Math.floor((nowTs - schedTs) / 60000);
            let dynamicMaxEndOffset = Math.floor((nowTs - expectedEndTs) / 60000);
            if (isNaN(dynamicMaxStartOffset)) dynamicMaxStartOffset = 0;
            if (isNaN(dynamicMaxEndOffset)) dynamicMaxEndOffset = 0;
            
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
                    if (isNaN(actualOffset)) actualOffset = 0;
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
                    if (isNaN(actualStartOffset)) actualStartOffset = 0;
                    if (actualStartOffset < -2880) actualStartOffset = -2880;
                    if (actualStartOffset > dynamicMaxStartOffset) actualStartOffset = dynamicMaxStartOffset;
                    setSliderOffsetMin(actualStartOffset); // lock start visually

                    if (activeEnd) {
                        const activeEndTs = new Date(activeEnd.actual_end_at || activeEnd.occurred_at).getTime();
                        let actualEndOffset = Math.round((activeEndTs - expectedEndTs) / 60000);
                        if (isNaN(actualEndOffset)) actualEndOffset = 0;
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
                    if (isNaN(actualOffset)) actualOffset = 0;
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
    }, [isOpen, slotTime, duration, requiresEndEvent, isPerfusionStarted, activePerfusionEvent, isPerfusion]);

    // --- History Grouping Logic ---
    const blocksArray = useMemo(() => {
        const filtered = (historyEvents || []).filter(ev => showCancelled || ev.status !== 'CANCELLED');
        const sorted = [...filtered].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
        
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

        const groupedMap = new Map<string, HistoryBlock>();

        sorted.forEach(ev => {
            const ts = new Date(ev.occurred_at).getTime();
            if (ev.linked_event_id) {
                if (!groupedMap.has(ev.linked_event_id)) {
                    groupedMap.set(ev.linked_event_id, { type: 'group', id: ev.linked_event_id, latestTs: ts });
                }
                const group = groupedMap.get(ev.linked_event_id)! as any;
                if (ev.action_type === 'started') group.start = ev;
                if (ev.action_type === 'ended') group.end = ev;
                if (ts > group.latestTs) group.latestTs = ts;
            } else {
                groupedMap.set(ev.id, { type: 'standalone', event: ev, latestTs: ts });
            }
        });

        return Array.from(groupedMap.values()).sort((a, b) => b.latestTs - a.latestTs);
    }, [historyEvents, showCancelled]);

    if (!isOpen) return null;

    // Formatting for Header
    const schedDateObj = new Date(slotTime);
    const isValidDate = (d: Date) => !isNaN(d.getTime());

    let schedDateStr = '';
    let schedTimeStr = '';
    if (isValidDate(schedDateObj)) {
        schedDateStr = schedDateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        schedTimeStr = schedDateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    
    let headerText = '';
    if (!isPerfusion) {
        headerText = `à administrer le ${schedDateStr} à ${schedTimeStr}`;
    } else {
        const expectedEndObj = new Date(schedDateObj.getTime() + duration * 60000);
        let expectedEndTimeStr = '';
        if (isValidDate(expectedEndObj)) {
            expectedEndTimeStr = expectedEndObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }
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
    
    let dynamicMaxStartOffset = Math.floor((nowTs - schedDateObj.getTime()) / 60000);
    let dynamicMaxEndOffset = Math.floor((nowTs - expectedEndDateObj.getTime()) / 60000);
    if (isNaN(dynamicMaxStartOffset)) dynamicMaxStartOffset = 0;
    if (isNaN(dynamicMaxEndOffset)) dynamicMaxEndOffset = 0;
    
    // Derived Date logic
    const getStartSliderDate = (offsetMins: number) => new Date(schedDateObj.getTime() + offsetMins * 60000);
    const getEndSliderDate = (offsetMins: number) => new Date(expectedEndDateObj.getTime() + offsetMins * 60000);
    const selectedStartObj = getStartSliderDate(sliderOffsetMin);
    const selectedEndObj = getEndSliderDate(sliderEndOffsetMin);

    const toDatetimeLocal = (d: Date) => {
        if (!d || isNaN(d.getTime())) return '';
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
        
        if (tacheEffectuee === 'OUI' && requiresFluidInfo && !isTransfusion) {
            const isEnding = !isPerfusion || (isPerfusion && (isPerfusionStarted || logEndSimultaneously));
            if (isEnding && (administeredVolume === '' || administeredVolume <= 0)) {
                return "Le volume administré est requis pour cette prescription.";
            }
        }

        if (tacheEffectuee === 'OUI' && isTransfusion) {
            if (!isPerfusionStarted) {
                if (selectedBags.length === 0) return "Veuillez sélectionner au moins une poche de sang à administrer.";
                
                for (const bagId of selectedBags) {
                     const bag = availableBags.find(b => b.id === bagId);
                     const v = bagVolumes[bagId] || 0;
                     if (v <= 0) return `Le volume administré pour la poche ${bag?.bag_number} doit être supérieur à 0.`;
                     if (bag?.volume_ml && v > bag.volume_ml) return `Le volume administré (${v} ml) pour la poche ${bag?.bag_number} dépasse le volume total de la poche (${bag.volume_ml} ml). Modifiez le volume de la poche dans l'onglet Réception si nécessaire.`;
                }

                if (!checks.identity || !checks.compatibility || !checks.bedside || !checks.vitals) {
                    return "Veuillez confirmer tous les contrôles pré-transfusionnels.";
                }
            } else {
                // If ending an already started perfusion
                const assignedBags = availableBags.filter(b => b.assigned_prescription_event_id === eventId);
                for (const bag of assignedBags) {
                     const v = bagVolumes[bag.id] || 0;
                     if (v <= 0) return `Le volume administré pour la poche ${bag?.bag_number} doit être supérieur à 0.`;
                     if (bag?.volume_ml && v > bag.volume_ml) return `Le volume administré (${v} ml) pour la poche ${bag?.bag_number} dépasse le volume total de la poche (${bag.volume_ml} ml). Modifiez le volume de la poche dans l'onglet Réception si nécessaire.`;
                }
            }
        }

        // Reaction mandatory rules: mandatory if START+END or END after START
        if (tacheEffectuee === 'OUI' && isTransfusion) {
            const isEnding = (isPerfusionStarted) || (!isPerfusionStarted && logEndSimultaneously);
            if (isEnding && reaction.present && !reaction.type) {
                 return "Vous avez indiqué une réaction transfusionnelle. Veuillez en préciser le type.";
            }
        }

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
            let transfusionPayload: any = undefined;
            let adminBags: { id: string; volume_ml: number; }[] = [];

            if (tacheEffectuee === 'OUI' && isTransfusion) {
                adminBags = selectedBags.map(id => ({ id, volume_ml: bagVolumes[id] || 0 }));
                transfusionPayload = {
                    bloodBagIds: selectedBags,
                    checks: {
                        identity_check_done: checks.identity,
                        compatibility_check_done: checks.compatibility,
                        bedside_double_check_done: checks.bedside,
                        vitals_baseline_done: checks.vitals,
                        notes: ''
                    },
                    reaction: {
                        reaction_present: reaction.present,
                        reaction_type: reaction.type,
                        description: reaction.notes || undefined,
                        actions_taken: undefined
                    }
                };
            }

            const payload: AdministrationSavePayload & { volume_administered_ml?: number | null } = {
                action_type: tacheEffectuee === 'OUI' ? 'administered' : 'refused',
                occurred_at: new Date().toISOString(),
                actual_start_at: selectedStartObj.toISOString(),
                actual_end_at: null,
                justification: tacheEffectuee === 'NON' ? motif : undefined,
                volume_administered_ml: tacheEffectuee === 'OUI' && requiresFluidInfo && !isTransfusion ? Number(administeredVolume) : undefined,
                transfusion: transfusionPayload,
                administered_bags: (tacheEffectuee === 'OUI' && isTransfusion && adminBags.length > 0) ? adminBags : undefined
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
            let transfusionPayload: any = undefined;
            let adminBags: { id: string; volume_ml: number; }[] = [];

            if (tacheEffectuee === 'OUI' && isTransfusion) {
                if (!isPerfusionStarted) {
                    transfusionPayload = {
                        bloodBagIds: selectedBags,
                        checks: {
                            identity_check_done: checks.identity,
                            compatibility_check_done: checks.compatibility,
                            bedside_double_check_done: checks.bedside,
                            vitals_baseline_done: checks.vitals,
                            notes: ''
                        }
                    };
                    adminBags = selectedBags.map(id => ({ id, volume_ml: bagVolumes[id] || 0 }));
                    if (logEndSimultaneously) {
                        transfusionPayload.reaction = {
                            reaction_present: reaction.present,
                            reaction_type: reaction.type,
                            description: reaction.notes || undefined,
                            actions_taken: undefined
                        };
                    }
                } else {
                    // Ending an already started perfusion
                    const assignedBags = availableBags.filter(b => b.assigned_prescription_event_id === eventId);
                    adminBags = assignedBags.map(b => ({ id: b.id, volume_ml: bagVolumes[b.id] || 0 }));
                    transfusionPayload = {
                        bloodBagIds: assignedBags.map(b => b.id),
                        checks: {
                            identity_check_done: true,
                            compatibility_check_done: true,
                            bedside_double_check_done: true,
                            vitals_baseline_done: true,
                            notes: ''
                        },
                        reaction: {
                            reaction_present: reaction.present,
                            reaction_type: reaction.type,
                            description: reaction.notes || undefined,
                            actions_taken: undefined
                        }
                    };
                }
            } else if (tacheEffectuee === 'OUI' && !isTransfusion) {
                // Perfusion Meds
                if (!isPerfusionStarted && logEndSimultaneously) {
                    const payloads: AdministrationSavePayload[] = [
                        {
                            action_type: 'started',
                            occurred_at: new Date().toISOString(),
                            actual_start_at: selectedStartObj.toISOString(),
                            actual_end_at: undefined,
                            linked_event_id: undefined,
                            volume_administered_ml: undefined,
                        },
                        {
                            action_type: 'ended',
                            occurred_at: new Date().toISOString(),
                            actual_start_at: selectedStartObj.toISOString(),
                            actual_end_at: selectedEndObj.toISOString(),
                            linked_event_id: undefined,
                            volume_administered_ml: Number(administeredVolume),
                        }
                    ];
                    onSave(payloads);
                    return;
                }

                const payload: AdministrationSavePayload = {
                    action_type: isPerfusionStarted ? 'ended' : 'started',
                    occurred_at: new Date().toISOString(),
                    actual_start_at: isPerfusionStarted ? undefined : selectedStartObj.toISOString(),
                    actual_end_at: isPerfusionStarted ? selectedEndObj.toISOString() : undefined,
                    linked_event_id: isPerfusionStarted && activePerfusionEvent ? activePerfusionEvent.linked_event_id : undefined,
                    volume_administered_ml: isPerfusionStarted ? Number(administeredVolume) : undefined,
                };
                onSave(payload);
                return;
            }

            if (!isPerfusionStarted) {
                // Initial START log
                const payloads: AdministrationSavePayload[] = [{
                    action_type: 'started',
                    occurred_at: new Date().toISOString(),
                    actual_start_at: selectedStartObj.toISOString(),
                    actual_end_at: null,
                    transfusion: transfusionPayload,
                    administered_bags: adminBags
                }];
                if (logEndSimultaneously) {
                    payloads.push({
                        action_type: 'ended',
                        occurred_at: new Date().toISOString(),
                        actual_start_at: selectedStartObj.toISOString(),
                        actual_end_at: selectedEndObj.toISOString(),
                        transfusion: transfusionPayload, // Pass reaction info if ending simultaneously
                        administered_bags: adminBags,
                        volume_administered_ml: requiresFluidInfo && !isTransfusion ? Number(administeredVolume) : undefined
                    });
                }
                onSave(payloads);
            } else {
                // Already started, ending now
                const payload: AdministrationSavePayload & { volume_administered_ml?: number | null } = {
                    action_type: 'ended',
                    occurred_at: new Date().toISOString(),
                    actual_start_at: selectedStartObj.toISOString(), // the mapped locked start
                    actual_end_at: selectedEndObj.toISOString(),
                    volume_administered_ml: requiresFluidInfo && !isTransfusion ? Number(administeredVolume) : undefined,
                    administered_bags: isTransfusion ? adminBags : undefined,
                    transfusion: isTransfusion ? transfusionPayload : undefined
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

    // The blocksArray memoization moved to the top level Hooks section

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

                            {/* VOLUME ADMINISTRÉ INPUT */}
                            {tacheEffectuee === 'OUI' && requiresFluidInfo && !isTransfusion && (
                                (!isPerfusion || (isPerfusion && (isPerfusionStarted || logEndSimultaneously))) && (
                                    <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-lg shadow-inner">
                                        <label className="block text-sm font-bold text-teal-800 mb-2">Volume administré (ml) *</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                min="0.1"
                                                step="0.1"
                                                value={administeredVolume}
                                                onChange={e => setAdministeredVolume(e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full pl-3 pr-10 py-2 border border-teal-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500 font-bold text-teal-900"
                                                placeholder="Ex: 250"
                                            />
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                <span className="text-teal-500 font-semibold text-sm">ml</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* TRANSFUSION SPECIFIC UI */}
                            {tacheEffectuee === 'OUI' && isTransfusion && !isPerfusionStarted && (
                                <div className="space-y-6 mt-6 p-5 bg-red-50 border border-red-200 rounded-lg shadow-inner">
                                    <h4 className="font-bold text-red-800 flex items-center mb-4">
                                        <AlertCircle size={18} className="mr-2" />
                                        Protocole de Transfusion (Sécurité)
                                    </h4>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Poches à raccorder</label>
                                        <div className="grid grid-cols-1 gap-3">
                                            {availableBags.filter(b => b.status !== 'DISCARDED' && (!b.assigned_prescription_event_id || b.assigned_prescription_event_id === eventId)).map(bag => (
                                                <div key={bag.id} className={`flex flex-col p-3 rounded-lg border transition-colors ${selectedBags.includes(bag.id) ? 'bg-red-100 border-red-400' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                                                    <label className="flex items-center cursor-pointer w-full">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 mr-3"
                                                            checked={selectedBags.includes(bag.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedBags(p => [...p, bag.id]);
                                                                    if (bag.volume_ml) setBagVolumes(prev => ({ ...prev, [bag.id]: bag.volume_ml }));
                                                                } else {
                                                                    setSelectedBags(p => p.filter(id => id !== bag.id));
                                                                    setBagVolumes(prev => { const n = {...prev}; delete n[bag.id]; return n; });
                                                                }
                                                            }}
                                                        />
                                                        <div className="flex-1">
                                                            <div className="font-bold text-sm text-gray-900">{bag.bag_number}</div>
                                                            <div className="text-xs text-gray-500">{bag.blood_product_code} • Gr: {bag.abo_group}{bag.rhesus} {bag.volume_ml ? `• Volume de la poche: ${bag.volume_ml} ml` : ''}</div>
                                                        </div>
                                                    </label>
                                                    
                                                    {selectedBags.includes(bag.id) && (
                                                        <div className="ml-7 mt-3 flex items-center bg-white p-2 rounded shadow-sm border border-red-200">
                                                            <span className="text-xs font-bold text-red-700 mr-3 w-[150px]">Volume administré (ml) * :</span>
                                                            <input 
                                                                type="number" 
                                                                className="w-[100px] border-gray-300 rounded text-sm font-bold shadow-sm focus:border-red-500 focus:ring-red-500"
                                                                value={bagVolumes[bag.id] || ''}
                                                                onChange={e => setBagVolumes(prev => ({ ...prev, [bag.id]: parseFloat(e.target.value) }))}
                                                                placeholder="ex: 250"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {availableBags.filter(b => b.status !== 'DISCARDED' && (!b.assigned_prescription_event_id || b.assigned_prescription_event_id === eventId)).length === 0 && (
                                                <div className="text-sm text-red-600 italic p-3 bg-red-100 rounded text-center">
                                                    Aucune poche disponible. Allez dans l'onglet Transfusion pour en ajouter.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="block text-sm font-bold text-gray-700 border-b border-red-200 pb-2">Contrôle Ultime Pré-Transfusionnel</label>
                                        <label className="flex items-center">
                                            <input type="checkbox" checked={checks.identity} onChange={e => setChecks(c => ({...c, identity: e.target.checked}))} className="w-4 h-4 text-red-600 rounded mr-3" />
                                            <span className="text-sm font-medium">Contrôle d'identité patient (Concordance Bracelet/Dossier)</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input type="checkbox" checked={checks.compatibility} onChange={e => setChecks(c => ({...c, compatibility: e.target.checked}))} className="w-4 h-4 text-red-600 rounded mr-3" />
                                            <span className="text-sm font-medium">Vérification de la compatibilité ABO/Rhésus (Fiche / Poche)</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input type="checkbox" checked={checks.bedside} onChange={e => setChecks(c => ({...c, bedside: e.target.checked}))} className="w-4 h-4 text-red-600 rounded mr-3" />
                                            <span className="text-sm font-medium">Double contrôle infirmier/médecin effectué au lit</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input type="checkbox" checked={checks.vitals} onChange={e => setChecks(c => ({...c, vitals: e.target.checked}))} className="w-4 h-4 text-red-600 rounded mr-3" />
                                            <span className="text-sm font-medium">Constantes de base (TA, T°, FC) enregistrées (Cf. Surveillance)</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* TRANSFUSION END VOLUME UI */}
                            {tacheEffectuee === 'OUI' && isTransfusion && isPerfusionStarted && (
                                <div className="space-y-6 mt-6 p-5 bg-red-50 border border-red-200 rounded-lg shadow-inner">
                                    <h4 className="font-bold text-red-800 flex items-center mb-4 border-b border-red-200 pb-2">
                                        <AlertCircle size={18} className="mr-2" />
                                        Volume Administré
                                    </h4>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Saisissez le volume final pour les poches raccordées :</label>
                                        <div className="grid grid-cols-1 gap-3">
                                            {availableBags.filter(b => b.assigned_prescription_event_id === eventId).map(bag => (
                                                <div key={bag.id} className="flex flex-col p-3 rounded-lg border bg-white border-gray-300">
                                                    <div className="flex-1 mb-2">
                                                        <div className="font-bold text-sm text-gray-900">{bag.bag_number}</div>
                                                        <div className="text-xs text-gray-500">{bag.blood_product_code} • Gr: {bag.abo_group}{bag.rhesus} {bag.volume_ml ? `• Volume de la poche: ${bag.volume_ml} ml` : ''}</div>
                                                    </div>
                                                    <div className="flex items-center bg-gray-50 p-2 rounded shadow-sm border border-red-200">
                                                        <span className="text-xs font-bold text-red-700 mr-3 w-[150px]">Volume administré (ml) * :</span>
                                                        <input 
                                                            type="number" 
                                                            className="w-[100px] border-gray-300 rounded text-sm font-bold shadow-sm focus:border-red-500 focus:ring-red-500"
                                                            value={bagVolumes[bag.id] || ''}
                                                            onChange={e => setBagVolumes(prev => ({ ...prev, [bag.id]: parseFloat(e.target.value) }))}
                                                            placeholder="ex: 250"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            {availableBags.filter(b => b.assigned_prescription_event_id === eventId).length === 0 && (
                                                <div className="text-sm text-red-600 italic p-3 bg-red-100 rounded text-center">
                                                    Aucune poche n'a été associée à ce début de transfusion.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* REACTION TRANSFUSIONNELLE (END PHASE) */}
                            {tacheEffectuee === 'OUI' && isTransfusion && ((isPerfusionStarted) || (!isPerfusionStarted && logEndSimultaneously)) && (
                                <div className="space-y-4 mt-6 p-5 bg-orange-50 border border-orange-200 rounded-lg shadow-inner">
                                    <h4 className="font-bold text-orange-800 flex items-center mb-4 border-b border-orange-200 pb-2">
                                        <AlertCircle size={18} className="mr-2" />
                                        Évaluation de la Transfusion
                                    </h4>

                                    <div className="flex items-center space-x-6">
                                        <span className="font-semibold text-gray-700 uppercase text-xs">Réaction Transfusionnelle ?</span>
                                        <div className="flex rounded-md overflow-hidden bg-white border border-gray-300 shadow-sm">
                                            <button 
                                                className={`px-4 py-1.5 font-bold transition-all text-sm ${!reaction.present ? 'bg-orange-100 text-orange-800' : 'bg-transparent text-gray-500'}`}
                                                onClick={() => setReaction(r => ({ ...r, present: false, type: '', notes: '' }))}
                                            >
                                                NON
                                            </button>
                                            <button 
                                                className={`px-4 py-1.5 font-bold transition-all text-sm ${reaction.present ? 'bg-red-600 text-white' : 'bg-transparent text-gray-500'}`}
                                                onClick={() => setReaction(r => ({ ...r, present: true }))}
                                            >
                                                OUI
                                            </button>
                                        </div>
                                    </div>

                                    {reaction.present && (
                                        <div className="animate-in fade-in slide-in-from-top-2 pt-3 space-y-3">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Type de réaction *</label>
                                                <select 
                                                    className="w-full border-gray-300 rounded shadow-sm focus:ring-red-500 text-sm font-medium"
                                                    value={reaction.type}
                                                    onChange={e => setReaction(r => ({ ...r, type: e.target.value }))}
                                                >
                                                    <option value="">Sélectionnez un type...</option>
                                                    <option value="ALLERGY">Allergique (Urticaire, Prurit)</option>
                                                    <option value="FEBRILE">Fébrile non hémolytique (Frissons, Fièvre &gt; 1°C)</option>
                                                    <option value="HEMOLYTIC">Hémolytique aiguë</option>
                                                    <option value="TACO">Surcharge volémique (TACO)</option>
                                                    <option value="TRALI">Lésion pulmonaire aiguë (TRALI)</option>
                                                    <option value="INFECTION">Infection bactérienne</option>
                                                    <option value="OTHER">Autre</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Détails de la réaction / Actions entreprises (Optionnel)</label>
                                                <textarea 
                                                    className="w-full text-sm border-gray-300 rounded shadow-sm h-16 focus:ring-red-500"
                                                    value={reaction.notes}
                                                    onChange={e => setReaction(r => ({ ...r, notes: e.target.value }))}
                                                    placeholder="Décrivez les symptômes et les soins prodigués..."
                                                />
                                            </div>
                                        </div>
                                    )}
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
                            {blocksArray.length === 0 ? (
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
                                            // The reaction is identical for start/end, so just pick one (prefer start)
                                            const reactionEv = group.start || group.end;
                                            return (
                                                <div key={`perf-group-${idx}`} className="bg-gray-300/50 p-3 rounded-lg border border-gray-300 relative">
                                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mr-2"></div>
                                                        Groupe Perfusion
                                                    </div>
                                                    <div className="space-y-2 relative pl-4 border-l-2 border-gray-400/30 ml-2">
                                                        {group.start && <HistoryItem ev={group.start} onCancel={() => onCancelClick(group.start.id)} hideReaction={true} />}
                                                        {group.end && <HistoryItem ev={group.end} onCancel={() => onCancelClick(group.end.id)} hideReaction={true} />}
                                                    </div>
                                                    {reactionEv && reactionEv.reaction && reactionEv.reaction.reaction_type && (
                                                        <div className="text-xs p-2 rounded mt-2 shadow-sm bg-red-50 text-red-900 border border-red-200">
                                                            <div className="font-bold flex items-center text-red-700 mb-1">
                                                                <AlertCircle size={12} className="mr-1" />
                                                                Réaction: {reactionEv.reaction.reaction_type}
                                                            </div>
                                                            {reactionEv.reaction.description && <div className="italic text-red-600 mb-0.5"><span className="font-semibold not-italic text-red-800">Détails:</span> {reactionEv.reaction.description}</div>}
                                                            {reactionEv.reaction.actions_taken && <div className="italic text-red-600"><span className="font-semibold not-italic text-red-800">Actions:</span> {reactionEv.reaction.actions_taken}</div>}
                                                        </div>
                                                    )}
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
const HistoryItem = ({ ev, onCancel, hideReaction = false }: { ev: any, onCancel: () => void, hideReaction?: boolean }) => {
    const isCancelled = ev.status === 'CANCELLED';
    
    const actionLabels: Record<string, string> = {
        administered: 'Administré',
        refused: 'Refusé',
        started: 'Début',
        ended: 'Fin'
    };
    
    const label = actionLabels[ev.action_type] || ev.action_type;
    const isError = ev.action_type === 'refused' || isCancelled;
    
    const targetAt = ev.actual_start_at || ev.actual_end_at || ev.occurred_at;
    let actionAt = ev.occurred_at;
    if (ev.action_type === 'ended') {
        actionAt = ev.actual_end_at || ev.occurred_at;
    } else if (ev.action_type === 'started' || ev.action_type === 'administered') {
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

            {ev.volume_administered_ml !== undefined && ev.volume_administered_ml !== null && !isCancelled && (
                <div className={`text-xs p-1.5 rounded mt-1 shadow-inner bg-teal-50 text-teal-800 border-l-2 border-teal-300`}>
                    <span className="font-bold">Volume administré:</span> {ev.volume_administered_ml} ml
                </div>
            )}

            {!hideReaction && !isCancelled && ev.reaction && ev.reaction.reaction_type && (
                <div className="text-xs p-2 rounded mt-1.5 shadow-inner bg-red-50 text-red-900 border border-red-200">
                    <div className="font-bold flex items-center text-red-700 mb-1">
                        <AlertCircle size={12} className="mr-1" />
                        Réaction: {ev.reaction.reaction_type}
                    </div>
                    {ev.reaction.description && <div className="italic text-red-600 mb-0.5"><span className="font-semibold not-italic text-red-800">Détails:</span> {ev.reaction.description}</div>}
                    {ev.reaction.actions_taken && <div className="italic text-red-600"><span className="font-semibold not-italic text-red-800">Actions:</span> {ev.reaction.actions_taken}</div>}
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
