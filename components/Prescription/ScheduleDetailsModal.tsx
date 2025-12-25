import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { FormData } from './types';
import { generateDoseSchedule } from './utils';

interface ScheduleDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    formData: FormData;
    manualDoseAdjustments?: Record<string, string>; // ID -> ISO Date
    skippedDoses?: string[]; // IDs
}

export const ScheduleDetailsModal: React.FC<ScheduleDetailsModalProps> = ({
    isOpen,
    onClose,
    formData,
    manualDoseAdjustments,
    skippedDoses
}) => {
    if (!isOpen) return null;

    // 1. Calculate the strict schedule with overrides
    const scheduleResult = generateDoseSchedule(
        formData.schedule,
        formData.prescriptionType || 'medication',
        undefined,
        formData.adminMode,
        formData.adminDuration,
        {
            skippedDoses: skippedDoses || formData.skippedDoses,
            manualDoseAdjustments: manualDoseAdjustments || formData.manualDoseAdjustments
        }
    );

    const doses = scheduleResult.scheduledDoses || [];

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Planning Détaillé</h3>
                        <p className="text-sm text-gray-500">{formData.commercialName || formData.molecule}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-0">
                    {doses.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 italic">
                            Aucune prise planifiée visible pour cette configuration.
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Heure Théorique</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">État</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Horaire Effectif</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {doses.map((dose, idx) => {
                                    const plannedDate = new Date(dose.plannedDateTime);
                                    let statusNode = <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Planifié</span>;
                                    let effectiveNode = <span className="text-gray-900 font-medium">{plannedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>;
                                    let rowClass = "hover:bg-gray-50 transition-colors";

                                    if (dose.isSkipped) {
                                        statusNode = (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                <AlertCircle size={10} className="mr-1" /> Annulé
                                            </span>
                                        );
                                        effectiveNode = <span className="text-gray-400 italic text-xs">--</span>;
                                        rowClass += " bg-red-50/30";
                                    } else if (dose.effectiveDateTime) {
                                        const effDate = new Date(dose.effectiveDateTime);
                                        statusNode = (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                                                <Clock size={10} className="mr-1" /> Modifié
                                            </span>
                                        );
                                        effectiveNode = (
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 line-through text-xs">
                                                    {plannedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <ArrowRight size={12} className="text-indigo-400" />
                                                <span className="text-indigo-900 font-bold">
                                                    {effDate.toLocaleDateString('fr-FR') !== plannedDate.toLocaleDateString('fr-FR') && (
                                                        <span className="text-xs mr-1 opacity-70">
                                                            {effDate.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })}
                                                        </span>
                                                    )}
                                                    {effDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                        rowClass += " bg-indigo-50/30";
                                    }

                                    return (
                                        <tr key={dose.id} className={rowClass}>
                                            <td className="px-6 py-3 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-gray-400" />
                                                    <span>{plannedDate.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    <span className="text-gray-300">|</span>
                                                    <span>{plannedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                {statusNode}
                                            </td>
                                            <td className="px-6 py-3 text-sm">
                                                {effectiveNode}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium shadow-sm hover:bg-gray-50">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
