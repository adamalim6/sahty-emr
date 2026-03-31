import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { calculateAge } from '../../../constants';
import { ArrowLeft, User, Activity, IdCard, Calendar, Fingerprint, Plus, Stethoscope, ChevronRight, Bed, Hash, Copy } from 'lucide-react';

export const LimsPatientPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [patient, setPatient] = useState<any>(null);
    const [admissions, setAdmissions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!id) return;
            setIsLoading(true);
            try {
                const pat = await api.limsConfig.execution.getPatient(id);
                setPatient(pat);
                const list = await api.limsConfig.execution.getPatientAdmissions(id);
                setAdmissions(list || []);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [id]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center bg-slate-50"><p className="text-slate-400 font-bold tracking-widest uppercase text-xs animate-pulse">Chargement...</p></div>;
    }

    if (!patient) return <div className="p-8 text-center text-red-500 font-bold">Patient introuvable</div>;

    const isFemale = patient.sex === 'Female' || patient.gender === 'Female' || patient.sex?.toLowerCase() === 'f';

    const getPrimaryId = () => {
        const primary = patient.identifiers?.find((i: any) => i.isPrimary) || patient.identifiers?.[0];
        return primary ? `${primary.identityTypeCode}: ${primary.identityValue}` : 'Aucune';
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header / Identity Banner */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col shrink-0">
                <button onClick={() => navigate('/lims/patients')} className="flex items-center text-slate-400 hover:text-indigo-600 mb-4 transition-colors text-xs font-bold uppercase tracking-widest w-fit">
                    <ArrowLeft size={16} className="mr-2" /> Retour à la recherche
                </button>
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-5">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border-2 shrink-0 ${isFemale ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                            <User size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                                {patient.lastName} {patient.firstName}
                            </h1>
                            <div className="flex items-center space-x-3 mt-1 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                <span className="flex items-center text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200"><Fingerprint size={12} className="mr-1"/>{patient.ipp}</span>
                                <span>•</span>
                                <span className="flex items-center"><Calendar size={12} className="mr-1"/>{calculateAge(patient.dob || patient.dateOfBirth)} ANS</span>
                                <span>•</span>
                                <span className="flex items-center"><Activity size={12} className="mr-1"/>{patient.sex || patient.gender}</span>
                                <span>•</span>
                                <span className="flex items-center"><IdCard size={12} className="mr-1"/>{getPrimaryId()}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <button onClick={() => navigate(`/lims/registration?patientId=${patient.id}`)} className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 text-white px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center transition-all active:scale-95">
                            <Plus size={16} className="mr-2" /> Nouvelle admission Labo
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Body: Admissions List */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center">
                            <Activity size={20} className="mr-2 text-indigo-500"/> Historique des admissions
                            <span className="ml-3 bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-xs">{admissions.length}</span>
                        </h2>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        {admissions.length > 0 ? (
                            <div className="flex flex-col">
                                {admissions.map((adm, index) => {
                                    const isHospital = adm.admissionType === 'HOSPITALISATION' || adm.admissionType === 'HOSP';
                                    const isWalkin = adm.type === 'LAB_WALKIN' || adm.admissionType === 'LAB_WALKIN';
                                    const isActive = adm.status === 'En cours';

                                    return (
                                        <button
                                            key={adm.id}
                                            onClick={() => navigate(`/lims/admissions/${adm.id}`)}
                                            className={`p-5 flex items-center justify-between transition-all group border-b border-slate-100 last:border-0 hover:bg-indigo-50/50 ${isActive ? 'bg-orange-50/30' : ''}`}
                                        >
                                            <div className="flex items-center space-x-6">
                                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border ${
                                                    isWalkin ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                }`}>
                                                    {isWalkin ? <Stethoscope size={24} /> : <Bed size={24} />}
                                                </div>
                                                
                                                <div className="flex flex-col items-start space-y-1">
                                                    <div className="flex items-center space-x-3">
                                                        <span className="font-black text-slate-800 tracking-tight">{adm.admissionNumber || adm.nda}</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                                                            isWalkin ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                        }`}>
                                                            {isWalkin ? 'Laboratoire' : 'Hospitalisation'}
                                                        </span>
                                                        {isActive && (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-700 border border-orange-200">En cours</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex items-center text-xs text-slate-500 font-medium space-x-4">
                                                        <span className="flex items-center"><Calendar size={12} className="mr-1 text-slate-400"/> {new Date(adm.admissionDate).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                        {adm.service && <span className="flex items-center"><Hash size={12} className="mr-1 text-slate-400"/> {adm.service}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="h-8 w-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:border-indigo-600 group-hover:text-white transition-all shadow-sm">
                                                <ChevronRight size={16} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                                <Activity size={48} className="mb-4 opacity-20" />
                                <span className="text-sm font-bold uppercase tracking-widest">Aucune admission trouvée</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
