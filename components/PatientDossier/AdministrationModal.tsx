import React, { useState } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { ExecutionStatus } from '../Prescription/types';

interface AdministrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (status: ExecutionStatus, justification?: string) => void;
    prescriptionName: string;
    slotTime: string;
    initialStatus?: ExecutionStatus;
    initialJustification?: string;
}

export const AdministrationModal: React.FC<AdministrationModalProps> = ({
    isOpen, onClose, onSave, prescriptionName, slotTime, initialStatus = 'planned', initialJustification = ''
}) => {
    const [status, setStatus] = useState<ExecutionStatus>(initialStatus === 'planned' ? 'administered' : initialStatus);
    const [justification, setJustification] = useState(initialJustification);

    if (!isOpen) return null;

    const handleSave = () => {
        if (status === 'not-administered' && !justification.trim()) {
            alert("Une justification est obligatoire pour une non-administration.");
            return;
        }
        onSave(status, justification);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">Validation Prise</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                        <div className="text-sm text-blue-600 font-bold uppercase tracking-wider mb-1">Prescription</div>
                        <div className="text-xl font-black text-gray-900">{prescriptionName}</div>
                        <div className="text-sm text-gray-500 mt-1 font-mono bg-white px-2 py-0.5 rounded inline-block border border-blue-100">
                            Heure prévue : <span className="font-bold text-gray-800">{slotTime}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">État de l'administration</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setStatus('administered')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${status === 'administered' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:border-emerald-200 text-gray-500 hover:bg-emerald-50/50'}`}
                            >
                                <CheckCircle size={32} className={`${status === 'administered' ? 'text-emerald-500' : 'text-gray-300'} mb-2`} />
                                <span className="font-bold text-sm">Administré</span>
                            </button>

                            <button
                                onClick={() => setStatus('not-administered')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${status === 'not-administered' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-red-200 text-gray-500 hover:bg-red-50/50'}`}
                            >
                                <XCircle size={32} className={`${status === 'not-administered' ? 'text-red-500' : 'text-gray-300'} mb-2`} />
                                <span className="font-bold text-sm">Non Administré</span>
                            </button>
                        </div>
                    </div>

                    {status === 'not-administered' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center">
                                <AlertTriangle size={12} className="mr-1" /> Justification obligatoire
                            </label>
                            <textarea
                                value={justification}
                                onChange={(e) => setJustification(e.target.value)}
                                placeholder="Pourquoi le soin n'a-t-il pas été administré ?"
                                className="w-full border border-red-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none min-h-[80px]"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-bold text-sm">Annuler</button>
                    <button
                        onClick={handleSave}
                        disabled={status === 'not-administered' && !justification.trim()}
                        className={`px-6 py-2 rounded-lg font-bold text-white shadow-sm transition-all active:scale-95 ${status === 'administered' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                    >
                        Valider
                    </button>
                </div>
            </div>
        </div>
    );
};
