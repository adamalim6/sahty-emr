
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Loader2, ArrowLeft, Building2, UserCog, Save, AlertCircle, CheckCircle } from 'lucide-react';

export const ClientDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [client, setClient] = useState<any>(null);
    const [error, setError] = useState('');

    // Form States
    const [clientForm, setClientForm] = useState({
        type: 'HOPITAL',
        designation: '',
        siege_social: '',
        representant_legal: ''
    });

    const [dsiForm, setDsiForm] = useState({
        username: '',
        password: ''
    });

    // Save States
    const [savingClient, setSavingClient] = useState(false);
    const [savingDsi, setSavingDsi] = useState(false);
    const [clientSuccess, setClientSuccess] = useState(false);
    const [dsiSuccess, setDsiSuccess] = useState(false);

    useEffect(() => {
        if (id) loadClientDetails(id);
    }, [id]);

    const loadClientDetails = async (clientId: string) => {
        try {
            const data = await api.getClientDetails(clientId);
            setClient(data);
            
            // Init Forms
            setClientForm({
                type: data.type,
                designation: data.designation,
                siege_social: data.siege_social,
                representant_legal: data.representant_legal || ''
            });

            if (data.dsi) {
                setDsiForm(prev => ({ ...prev, username: data.dsi.username }));
            }
        } catch (err) {
            setError('Impossible de charger les détails du client.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingClient(true);
        setClientSuccess(false);
        try {
            await api.updateClient(id!, clientForm);
            setClientSuccess(true);
            setTimeout(() => setClientSuccess(false), 3000);
        } catch (err) {
            alert('Erreur lors de la mise à jour du client');
        } finally {
            setSavingClient(false);
        }
    };

    const handleUpdateDsi = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingDsi(true);
        setDsiSuccess(false);
        try {
            await api.updateClientDSI(id!, dsiForm);
            setDsiSuccess(true);
            setDsiForm(prev => ({ ...prev, password: '' })); // Clear password field
            setTimeout(() => setDsiSuccess(false), 3000);
        } catch (err) {
            alert('Erreur lors de la mise à jour du compte DSI');
        } finally {
            setSavingDsi(false);
        }
    };

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
    if (error) return <div className="p-12 text-center text-red-600">{error}</div>;
    if (!client) return <div className="p-12 text-center">Client introuvable</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <button 
                onClick={() => navigate('/super-admin/clients')}
                className="flex items-center text-slate-500 hover:text-blue-600 transition-colors mb-6"
            >
                <ArrowLeft size={18} className="mr-2" /> Retour à la liste
            </button>

            <div className="mb-8">
                <div className="flex items-center space-x-4 mb-2">
                    <div className="p-3 bg-blue-100 rounded-lg text-blue-700">
                        <Building2 size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{clientForm.designation}</h1>
                        <div className="flex items-center text-slate-500 mt-1">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider mr-2">{client.type}</span>
                            <span className="text-sm">{client.id}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Client Details Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center">
                            <Building2 size={20} className="mr-2 text-blue-600" />
                            Informations Structure
                        </h2>
                        {clientSuccess && <span className="text-green-600 text-sm font-medium flex items-center"><CheckCircle size={16} className="mr-1"/> Enregistré</span>}
                    </div>
                    <form onSubmit={handleUpdateClient} className="p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Type de structure</label>
                            <select 
                                className="w-full border rounded-lg p-2.5 bg-slate-50 focus:bg-white transition-colors"
                                value={clientForm.type}
                                onChange={e => setClientForm({...clientForm, type: e.target.value})}
                            >
                                <option value="HOPITAL">Hôpital</option>
                                <option value="CLINIQUE">Clinique</option>
                                <option value="CABINET">Cabinet</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Désignation</label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg p-2.5"
                                value={clientForm.designation}
                                onChange={e => setClientForm({...clientForm, designation: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Siège Social</label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg p-2.5"
                                value={clientForm.siege_social}
                                onChange={e => setClientForm({...clientForm, siege_social: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Représentant Légal</label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg p-2.5"
                                value={clientForm.representant_legal}
                                onChange={e => setClientForm({...clientForm, representant_legal: e.target.value})}
                            />
                        </div>
                        
                        <div className="pt-4 flex justify-end">
                            <button 
                                type="submit" 
                                disabled={savingClient}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium disabled:opacity-50"
                            >
                                {savingClient ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} className="mr-2" /> Enregistrer</>}
                            </button>
                        </div>
                    </form>
                </div>

                {/* 2. DSI Account Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center">
                            <UserCog size={20} className="mr-2 text-violet-600" />
                            Compte Administrateur DSI
                        </h2>
                        {dsiSuccess && <span className="text-green-600 text-sm font-medium flex items-center"><CheckCircle size={16} className="mr-1"/> Mis à jour</span>}
                    </div>

                    <form onSubmit={handleUpdateDsi} className="p-6 space-y-6">
                            {client.dsi ? (
                                <div className="bg-violet-50 p-4 rounded-lg flex items-start mb-6">
                                    <div className="mr-3 mt-1 text-violet-600 font-bold bg-white w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                                        {client.dsi.prenom?.charAt(0)}{client.dsi.nom?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700">{client.dsi.prenom} {client.dsi.nom}</p>
                                        <p className="text-sm text-slate-500">Super Admin Tenant</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-amber-50 p-4 rounded-lg flex items-start mb-6">
                                    <AlertCircle className="text-amber-600 mr-2 mt-0.5" size={20} />
                                    <div>
                                        <p className="font-bold text-amber-800">Aucun compte DSI</p>
                                        <p className="text-sm text-amber-700">Veuillez créer un compte administrateur pour ce client.</p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nom d'utilisateur (Login)</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded-lg p-2.5 font-mono text-slate-600 bg-slate-50 focus:bg-white transition-colors"
                                    value={dsiForm.username}
                                    placeholder={!client.dsi ? "ex: admin_hopital" : ""}
                                    onChange={e => setDsiForm({...dsiForm, username: e.target.value})}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {client.dsi ? "Nouveau Mot de passe" : "Mot de passe"}
                                </label>
                                <input 
                                    type="password" 
                                    className="w-full border rounded-lg p-2.5"
                                    placeholder={client.dsi ? "Laisser vide pour ne pas changer" : "Obligatoire pour la création"}
                                    value={dsiForm.password}
                                    onChange={e => setDsiForm({...dsiForm, password: e.target.value})}
                                    required={!client.dsi}
                                />
                                {client.dsi && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Minimum 6 caractères recommandé. Remplace le mot de passe actuel.
                                    </p>
                                )}
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button 
                                    type="submit" 
                                    disabled={savingDsi}
                                    className="bg-violet-600 text-white px-6 py-2 rounded-lg hover:bg-violet-700 transition-colors flex items-center font-medium disabled:opacity-50"
                                >
                                    {savingDsi ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} className="mr-2" /> {client.dsi ? "Mettre à jour DSI" : "Créer Compte DSI"}</>}
                                </button>
                            </div>
                        </form>
                </div>
            </div>
        </div>
    );
};
