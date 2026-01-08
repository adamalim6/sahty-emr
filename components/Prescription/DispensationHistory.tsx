import React, { useState, useEffect } from 'react';
import { Calendar, Package, User, FileText } from 'lucide-react';
import { api } from '../../services/api';

interface DispensationHistoryProps {
    prescriptionId: string;
    compact?: boolean;
    lastUpdate?: number;
}

export const DispensationHistory: React.FC<DispensationHistoryProps> = ({ prescriptionId, compact = false, lastUpdate }) => {
    const [dispensations, setDispensations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadDispensations();
    }, [prescriptionId, lastUpdate]);

    const loadDispensations = async () => {
        setIsLoading(true);
        try {
            const data = await api.getDispensationsByPrescription(prescriptionId);
            setDispensations(data);
        } catch (error) {
            console.error('Error loading dispensations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (isLoading) {
        return (
            <div className={`bg-slate-50 border border-slate-200 ${compact ? 'p-3 rounded-lg' : 'p-6 rounded-2xl'}`}>
                <p className="text-sm text-slate-500 italic text-center">Chargement...</p>
            </div>
        );
    }

    if (dispensations.length === 0) {
        return (
            <div className={`bg-slate-50 border border-slate-200 ${compact ? 'p-3 rounded-lg' : 'p-6 rounded-2xl'}`}>
                {!compact && (
                    <h4 className="text-lg font-black text-slate-700 uppercase tracking-tight mb-2 flex items-center">
                        <FileText size={20} className="mr-2" />
                        Historique des dispensations
                    </h4>
                )}
                <p className="text-sm text-slate-500 italic text-center">Aucun historique</p>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="space-y-3">
                {dispensations.map((disp, index) => (
                    <div key={disp.id} className="relative pl-4 group">
                        {/* Timeline Connector */}
                        {index !== dispensations.length - 1 && (
                            <div className="absolute left-[7px] top-6 bottom-[-12px] w-0.5 bg-slate-100 group-hover:bg-indigo-50 transition-colors"></div>
                        )}
                        <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm bg-indigo-500 z-10 ring-2 ring-indigo-50"></div>

                        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-3 hover:shadow-md hover:border-indigo-100 transition-all cursor-default">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">{disp.productName || 'Médicament'}</div>
                                    <div className="text-[10px] text-slate-400 font-medium font-mono mt-0.5">LOT: {disp.lotNumber}</div>
                                </div>
                                <div className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${disp.mode === 'UNIT' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                                    }`}>
                                    {disp.mode === 'UNIT' ? 'Unité' : 'Boîte'}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mb-2 text-[10px] text-slate-500">
                                <div className="flex items-center" title="Dispensé par">
                                    <User size={10} className="mr-1"/>{disp.dispensedBy}
                                </div>
                                <div className="flex items-center" title="Date de péremption">
                                    <Calendar size={10} className="mr-1"/>Exp: {new Date(disp.expiryDate).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-xl font-black text-slate-700">{disp.quantity} <span className="text-xs font-normal text-slate-500">{disp.mode === 'UNIT' ? 'unt' : 'bte'}</span></span>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-emerald-600">
                                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(disp.totalPriceInclVAT)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 capitalize">{new Date(disp.dispensedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-full flex flex-col">
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-6 flex items-center">
                <FileText size={16} className="mr-2" />
                Historique des dispensations
            </h4>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {dispensations.map((disp, index) => (
                    <div key={disp.id} className="relative pl-6 pb-2">
                        {/* Timeline Line */}
                        {index !== dispensations.length - 1 && (
                            <div className="absolute left-[9px] top-6 bottom-0 w-0.5 bg-slate-100"></div>
                        )}
                        {/* Timeline Dot */}
                        <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-indigo-50 border-2 border-indigo-500 flex items-center justify-center z-10">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                        </div>

                        <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all group">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h5 className="font-bold text-slate-800 text-base">{disp.productName || 'Médicament'}</h5>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">SN: {disp.serialNumber?.split('-').pop()}</span>
                                        <span className="text-xs text-slate-500">Lot: <span className="font-medium text-slate-700">{disp.lotNumber}</span></span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-2xl font-black text-slate-900 leading-none">{disp.quantity}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{disp.mode === 'UNIT' ? 'Unités' : 'Boîtes'}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-end pt-3 border-t border-slate-200/50">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center text-xs text-slate-400" title="Dispensé par">
                                            <User size={12} className="mr-1" />
                                            <span className="font-medium text-slate-600">{disp.dispensedBy}</span>
                                        </div>
                                        <div className="flex items-center text-xs text-slate-400" title="Date de péremption">
                                            <Calendar size={12} className="mr-1" />
                                            Exp: {new Date(disp.expiryDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-1 rounded-md">
                                        {disp.totalPriceInclVAT.toFixed(2)}€
                                    </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Sticky Total */}
            {dispensations.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Total ce jour</span>
                        <div className="text-right">
                            <div className="font-black text-lg text-slate-800">{dispensations.reduce((acc, d) => acc + d.totalPriceInclVAT, 0).toFixed(2)}€</div>
                            <div className="text-xs text-slate-400">{dispensations.length} dispensations</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
