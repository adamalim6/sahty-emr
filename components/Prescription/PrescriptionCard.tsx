
import React from 'react';
import {
    Pill,
    Calendar,
    Clock,
    Activity,
    FlaskConical,
    FileText,
    AlertCircle,
    Timer
} from 'lucide-react';
import { FormData } from './types';
import { getPosologyText, formatDuration } from './utils';

interface PrescriptionCardProps {
    formData: FormData;
    extraContent?: React.ReactNode;
}

export const PrescriptionCard: React.FC<PrescriptionCardProps> = ({ formData, extraContent }) => {
    const posologyText = getPosologyText(formData);

    if (!formData.molecule) {
        return (
            <div className="flex flex-col items-center text-center text-slate-400 py-4">
                <Activity className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Remplissez le formulaire pour voir l'aperçu</p>
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
            {posologyText && (
                <div className="flex items-start gap-3 bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900 mt-2 animate-in fade-in slide-in-from-left-2">
                    <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    <p className="font-medium leading-relaxed">{posologyText}</p>
                </div>
            )}

            {extraContent}

            {(() => {
                const isPunctual = formData.type === 'punctual-frequency';
                const displayDate = isPunctual
                    ? new Date()
                    : (formData.schedule.startDateTime ? new Date(formData.schedule.startDateTime) : null);

                const shouldShowDateInfo = isPunctual || (displayDate && !isNaN(displayDate.getTime()));

                if (!shouldShowDateInfo || !displayDate) return null;

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
