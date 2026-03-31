import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { Patient, Admission } from '../../../types';
import { LimsRegistrationIdentityPanel } from './LimsRegistrationIdentityPanel';
import { LimsRegistrationTestCart, CartTestItem } from './LimsRegistrationTestCart';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const LimsRegistrationPage = () => {
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
    const [cart, setCart] = useState<CartTestItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            } else if (e.key === 'Escape') {
                if (cart.length > 0) setCart([]);
                else handleReset();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [cart, selectedPatient, selectedAdmission, isSubmitting]);

    const handleReady = (patient: Patient, admission: Admission) => {
        setSelectedPatient(patient);
        setSelectedAdmission(admission);
    };

    const handleReset = () => {
        setSelectedPatient(null);
        setSelectedAdmission(null);
        setCart([]);
    };

    const handleSubmit = async () => {
        if (!selectedPatient || !selectedAdmission || cart.length === 0 || isSubmitting) {
            toast.error("Veuillez sélectionner un patient, une admission et au moins une analyse.");
            return;
        }

        try {
            setIsSubmitting(true);
            const globalActIds = cart.map(item => item.global_act_id);
            
            await api.limsConfig.execution.createLabRequests({
                tenantPatientId: selectedPatient.id,
                admissionId: selectedAdmission.id,
                globalActIds
            });

            toast.success("Demande(s) enregistrée(s) avec succès !", { duration: 3000 });
            
            // Post-Submit Model B behavior
            handleReset();

        } catch (e: any) {
            toast.error(e.message || "Erreur lors de l'enregistrement");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
            
            {/* Left Panel */}
            <LimsRegistrationIdentityPanel 
                onReady={handleReady} 
                onReset={handleReset} 
                selectedPatient={selectedPatient}
                selectedAdmission={selectedAdmission}
            />

            {/* Right Panel */}
            <div className="flex-1 flex flex-col relative min-w-0 bg-white">
                <LimsRegistrationTestCart 
                    cart={cart}
                    onCartChange={setCart}
                    disabled={!selectedPatient || !selectedAdmission}
                />
                
                {/* Fixed Bottom Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 flex justify-between items-center transition-transform">
                    <div className="text-slate-500 font-semibold text-sm flex items-center space-x-4">
                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 uppercase tracking-widest text-[10px] font-black shadow-sm">CTRL + ENTER</span>
                        <span>pour enregistrer et réinitialiser</span>

                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 uppercase tracking-widest text-[10px] font-black shadow-sm ml-4">ESC</span>
                        <span>pour annuler</span>
                    </div>

                    <div className="flex items-center space-x-3">
                        <span className="font-bold text-slate-800 text-lg">{cart.length} actes</span>
                        
                        <button 
                            onClick={handleSubmit}
                            disabled={!selectedPatient || !selectedAdmission || cart.length === 0 || isSubmitting}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold uppercase tracking-wider text-sm px-8 py-3 rounded-xl shadow-sm transition-all flex items-center space-x-2"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                            <span>Soumettre</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Global Loader Overlay */}
            {isSubmitting && (
                <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center">
                    <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 flex flex-col items-center animate-in zoom-in-95 duration-200">
                        <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Traitement en cours...</h3>
                        <p className="text-sm font-semibold text-slate-500 mt-1">Création des demandes d'analyses</p>
                    </div>
                </div>
            )}
        </div>
    );
};
