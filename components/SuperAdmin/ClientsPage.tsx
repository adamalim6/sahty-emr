
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Plus, Search, Building2, Users, RefreshCw } from 'lucide-react';

export const ClientsPage: React.FC = () => {
    const navigate = useNavigate();
    const [clients, setClients] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Schema Update State
    const [isUpdatingAll, setIsUpdatingAll] = useState(false);
    const [updatingTenants, setUpdatingTenants] = useState<Record<string, boolean>>({});
    
    // Form State
    const [formData, setFormData] = useState({
        type: 'HOPITAL',
        designation: '',
        siege_social: '',
        representant_legal: '',
        admin_username: '',
        admin_password: '',
        admin_nom: '',
        admin_prenom: '',
        country: 'MAROC',
        tenancy_mode: 'STANDALONE',
        group_id: ''
    });

    useEffect(() => {
        loadClients();
        loadGroups();
    }, []);

    const loadClients = async () => {
        try {
            const data = await api.getTenants();
            setClients(data);
        } catch (e) {
            console.error('Failed to load tenants', e);
        }
    };

    const loadGroups = async () => {
        try {
            const data = await api.getGroups();
            setGroups(data);
        } catch (e) {
            console.error('Failed to load groups', e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                group_id: formData.tenancy_mode === 'GROUP_MANAGED' ? formData.group_id : null
            };
            await api.createTenant(payload);
            setIsModalOpen(false);
            setFormData({
                type: 'HOPITAL', designation: '', siege_social: '', representant_legal: '',
                admin_username: '', admin_password: '', admin_nom: '', admin_prenom: '', 
                country: 'MAROC', tenancy_mode: 'STANDALONE', group_id: ''
            });
            loadClients();
        } catch (e) {
            alert('Failed to create tenant');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateAll = async () => {
        if (!window.confirm("Êtes-vous sûr de vouloir lancer la mise à jour des schémas de référence pour TOUS les locataires ? Cette opération peut prendre un certain temps.")) return;
        setIsUpdatingAll(true);
        try {
            const res = await api.updateAllReferenceSchemas();
            const detailsText = res.summary.map((s: any) => 
                `- ${s.designation}: ${s.status === 'success' ? `V${s.fromVersion} → V${s.toVersion}` : s.status === 'skipped' ? `Déjà à jour (V${s.fromVersion})` : `Erreur: ${s.error || 'Échec'}`}`
            ).join('\n');
            alert(`Mise à jour globale terminée.\n\nDétails:\n${detailsText}`);
        } catch (e: any) {
            alert(`Erreur lors de la mise à jour globale: ${e.message}`);
        } finally {
            setIsUpdatingAll(false);
        }
    };

    const handleUpdateSingle = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (!window.confirm(`Mettre à jour le schéma de référence de : ${name} ?`)) return;
        setUpdatingTenants(prev => ({ ...prev, [id]: true }));
        try {
            const res = await api.updateTenantReferenceSchema(id);
            if (res.status === 'skipped') {
                if (res.dataSyncStatus === 'error') {
                    alert(`${name} : Le schéma est à jour (Version ${res.fromVersion}) MAIS l'erreur de synchronisation des données: ${res.dataSyncError}`);
                } else {
                    alert(`${name} : Déjà à jour (Version ${res.fromVersion}) et données synchronisées.`);
                }
            } else {
                if (res.dataSyncStatus === 'error') {
                    alert(`${name} : Schéma mis à jour (V${res.toVersion}) MAIS erreur de synchronisation des données: ${res.dataSyncError}`);
                } else {
                    alert(`${name} : Mis à jour avec succès de V${res.fromVersion} vers V${res.toVersion} et données synchronisées.`);
                }
            }
        } catch (err: any) {
            alert(`Erreur pour ${name}: ${err.message}`);
        } finally {
            setUpdatingTenants(prev => ({ ...prev, [id]: false }));
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Gestion des Clients</h1>
                    <p className="text-slate-500">Ajouter et gérer les établissements de santé</p>
                </div>
                <div className="flex space-x-3">
                    <button 
                        onClick={handleUpdateAll}
                        disabled={isUpdatingAll}
                        className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                            isUpdatingAll ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                        title="Met à jour les schémas de référence de tous les locataires existants."
                    >
                        <RefreshCw size={20} className={isUpdatingAll ? "animate-spin" : ""} />
                        <span>{isUpdatingAll ? 'Mise à jour en cours...' : 'Update ALL Tenants'}</span>
                    </button>

                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                    >
                        <Plus size={20} />
                        <span>Nouveau Client</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map(client => (
                    <div 
                        key={client.id} 
                        onClick={() => navigate(`/super-admin/clients/${client.id}`)}
                        className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                <Building2 className="text-blue-600" size={24} />
                            </div>
                            <div className="flex items-center space-x-2">
                                {client.tenancy_mode === 'GROUP_MANAGED' && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full flex items-center space-x-1">
                                        <Users size={12} />
                                        <span>Groupe</span>
                                    </span>
                                )}
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                                    {client.type}
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-start mt-2">
                            <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">{client.designation}</h3>
                            
                            <button
                                onClick={(e) => handleUpdateSingle(e, client.id, client.designation)}
                                disabled={updatingTenants[client.id]}
                                className={`p-2 rounded-lg transition-colors border ${
                                    updatingTenants[client.id] 
                                        ? 'bg-slate-100 text-slate-400 border-slate-200' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800 hover:border-slate-800'
                                }`}
                                title="Update this tenant"
                            >
                                <RefreshCw size={18} className={updatingTenants[client.id] ? "animate-spin" : ""} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{client.siege_social}</p>
                        
                        <div className="border-t border-slate-100 pt-4 mt-4">
                            <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Représentant Légal</p>
                            <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                    {client.representant_legal?.charAt(0)}
                                </div>
                                <span className="text-sm text-slate-700">{client.representant_legal}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">Nouveau Client</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Client Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Information Structure</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                        <select 
                                            className="w-full border rounded-lg p-2"
                                            value={formData.type}
                                            onChange={e => setFormData({...formData, type: e.target.value})}
                                        >
                                            <option value="HOPITAL">Hôpital</option>
                                            <option value="CLINIQUE">Clinique</option>
                                            <option value="CABINET">Cabinet</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Désignation</label>
                                        <input 
                                            type="text" className="w-full border rounded-lg p-2" required
                                            value={formData.designation}
                                            onChange={e => setFormData({...formData, designation: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Siège Social</label>
                                        <input 
                                            type="text" className="w-full border rounded-lg p-2" required
                                            value={formData.siege_social}
                                            onChange={e => setFormData({...formData, siege_social: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Représentant Légal</label>
                                        <input 
                                            type="text" className="w-full border rounded-lg p-2" required
                                            value={formData.representant_legal}
                                            onChange={e => setFormData({...formData, representant_legal: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Pays / Région</label>
                                        <select 
                                            className="w-full border rounded-lg p-2"
                                            value={formData.country}
                                            onChange={e => setFormData({...formData, country: e.target.value})}
                                        >
                                            <option value="MAROC">Maroc</option>
                                            <option value="ARABIE_SAOUDITE">Arabie Saoudite</option>
                                            <option value="GCC">GCC</option>
                                            <option value="FRANCE">France</option>
                                            <option value="ETATS_UNIS">Etats-Unis</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Tenancy Mode */}
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h3 className="text-sm font-bold text-purple-600 uppercase tracking-wider">Mode de Rattachement</h3>
                                <div className="flex space-x-4">
                                    <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                        formData.tenancy_mode === 'STANDALONE' 
                                            ? 'border-purple-500 bg-purple-50' 
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}>
                                        <input 
                                            type="radio" name="tenancy_mode" value="STANDALONE" className="sr-only"
                                            checked={formData.tenancy_mode === 'STANDALONE'}
                                            onChange={() => setFormData({...formData, tenancy_mode: 'STANDALONE', group_id: ''})}
                                        />
                                        <div className="font-semibold text-slate-800">Autonome</div>
                                        <p className="text-xs text-slate-500 mt-1">Structure indépendante</p>
                                    </label>
                                    <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                        formData.tenancy_mode === 'GROUP_MANAGED' 
                                            ? 'border-purple-500 bg-purple-50' 
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}>
                                        <input 
                                            type="radio" name="tenancy_mode" value="GROUP_MANAGED" className="sr-only"
                                            checked={formData.tenancy_mode === 'GROUP_MANAGED'}
                                            onChange={() => setFormData({...formData, tenancy_mode: 'GROUP_MANAGED'})}
                                        />
                                        <div className="font-semibold text-slate-800">Rattaché à un Groupe</div>
                                        <p className="text-xs text-slate-500 mt-1">Authentification centralisée</p>
                                    </label>
                                </div>
                                {formData.tenancy_mode === 'GROUP_MANAGED' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Groupe</label>
                                        <select 
                                            className="w-full border rounded-lg p-2"
                                            value={formData.group_id}
                                            onChange={e => setFormData({...formData, group_id: e.target.value})}
                                            required
                                        >
                                            <option value="">— Sélectionner un groupe —</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Tenant Admin Info */}
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Administrateur Tenant (DSI)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
                                        <input 
                                            type="text" className="w-full border rounded-lg p-2" required
                                            value={formData.admin_nom}
                                            onChange={e => setFormData({...formData, admin_nom: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Prénom</label>
                                        <input 
                                            type="text" className="w-full border rounded-lg p-2" required
                                            value={formData.admin_prenom}
                                            onChange={e => setFormData({...formData, admin_prenom: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nom d'utilisateur</label>
                                        <input 
                                            type="text" className="w-full border rounded-lg p-2" required
                                            value={formData.admin_username}
                                            onChange={e => setFormData({...formData, admin_username: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
                                        <input 
                                            type="password" className="w-full border rounded-lg p-2" required
                                            value={formData.admin_password}
                                            onChange={e => setFormData({...formData, admin_password: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSubmitting}
                                    className={`px-4 py-2 rounded-lg ${isSubmitting ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    Annuler
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`px-4 py-2 rounded-lg text-white flex items-center space-x-2 transition-all ${
                                        isSubmitting 
                                            ? 'bg-blue-400 cursor-not-allowed' 
                                            : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    {isSubmitting && (
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                        </svg>
                                    )}
                                    <span>{isSubmitting ? 'Création en cours...' : 'Créer Client & Admin'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
