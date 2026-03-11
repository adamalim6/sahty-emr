import React, { useState, useEffect } from 'react';
import { Body3DViewer } from './Body3DViewer';
import { api } from '../../services/api';
import { EscarreModal } from './EscarreModal';
import { Activity, Plus, FileText, AlertCircle } from 'lucide-react';

interface EscarresProps {
    patientId: string;
    sex?: string;
    isActiveWorkspace?: boolean;
    isActiveTab?: boolean;
}

export interface EscarreData {
    id: string;
    tenantPatientId: string;
    isActive: boolean;
    createdAt: string;
    createdBy: string;
    posX: number;
    posY: number;
    posZ: number;
    bodySide?: string;
    bodyRegion?: string;
    latestSnapshot: any;
}

export const Escarres: React.FC<EscarresProps> = ({ patientId, sex, isActiveWorkspace = true, isActiveTab = true }) => {
    const [escarres, setEscarres] = useState<EscarreData[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEscarreId, setSelectedEscarreId] = useState<string | null>(null);
    const [pendingPlacement, setPendingPlacement] = useState<{ x: number, y: number, z: number } | null>(null);

    const loadEscarres = async () => {
        try {
            setLoading(true);
            const data = await api.getEscarres(patientId);
            setEscarres(data);
        } catch (e) {
            console.error("Failed to load escarres", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (patientId) loadEscarres();
    }, [patientId]);

    const handleAddRequest = (localCoords: { x: number, y: number, z: number }) => {
        setPendingPlacement(localCoords);
        setSelectedEscarreId(null);
        setIsModalOpen(true);
    };

    const handleMarkerClick = (id: string) => {
        setSelectedEscarreId(id);
        setPendingPlacement(null);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setPendingPlacement(null);
        setSelectedEscarreId(null);
    };

    const handleSaveSuccess = () => {
        handleModalClose();
        loadEscarres();
    };

    const activeMarkers = escarres.filter(e => e.isActive).map(e => ({
        id: e.id,
        posX: e.posX,
        posY: e.posY,
        posZ: e.posZ,
        stage: e.latestSnapshot?.stage || 1,
        isActive: e.isActive
    }));

    return (
        <div className="bg-white flex flex-col h-[900px] xl:h-[1000px] overflow-hidden">

            {/* Split View */}
            <div className="flex flex-1 overflow-hidden">
                {/* 3D Viewer Left Side */}
                <div className="w-2/3 h-full relative border-r border-slate-100 bg-slate-50/50">
                    <Body3DViewer 
                        sex={sex} 
                        markers={activeMarkers} 
                        onAddEscarreRequest={handleAddRequest} 
                        onMarkerClick={handleMarkerClick}
                    />
                </div>

                {/* List Right Side */}
                <div className="w-1/3 h-full overflow-y-auto bg-white p-4">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                        Lésions Documentées
                    </h3>
                    
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : escarres.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                            <Activity className="w-8 h-8 mb-3 opacity-50" />
                            <p className="text-sm font-medium">Aucune escarre</p>
                            <p className="text-xs mt-1">Le patient ne présente aucune lésion enregistrée.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {escarres.map(esc => (
                                <div 
                                    key={esc.id} 
                                    onClick={() => handleMarkerClick(esc.id)}
                                    className={`p-3 rounded-xl border cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all text-left ${esc.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-75'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full ${esc.isActive ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                            <span className="font-bold text-slate-700 text-sm">
                                                Stade {esc.latestSnapshot?.stage || '?'}
                                            </span>
                                        </div>
                                        {esc.isActive ? (
                                            <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded border border-green-100">Actif</span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200">Résolu</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 grid gap-1">
                                        <div className="flex items-center gap-1.5">
                                            <FileText className="w-3 h-3" />
                                            <span>{new Date(esc.latestSnapshot?.recordedAt).toLocaleString('fr-FR')}</span>
                                        </div>
                                        {esc.latestSnapshot?.notes && (
                                            <div className="line-clamp-2 italic text-slate-400">"{esc.latestSnapshot.notes}"</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Injection */}
            {isModalOpen && (
                <EscarreModal 
                    patientId={patientId}
                    escarreId={selectedEscarreId}
                    pendingCoords={pendingPlacement}
                    onClose={handleModalClose}
                    onSuccess={handleSaveSuccess}
                />
            )}
        </div>
    );
};
