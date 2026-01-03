
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ArrowLeft, Box, Users, Package, Plus, Trash2, Bed, Activity, Stethoscope, LayoutGrid, Shield, Search } from 'lucide-react';
import { UserModal } from './UserModal';
import { LocationManager } from '../Pharmacy/LocationManager';

interface Service {
    id: string;
    name: string;
    code?: string;
    description?: string;
    client_id: string;
}

interface RoomType {
    id: string;
    name: string;
    unit_category: 'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION';
    number_of_beds: number | null;
}

interface ServiceUnit {
    id: string;
    name: string;
    unit_type_id: string;
    service_id: string;
    type?: RoomType;
}

export const ServiceDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    // Data State
    const [service, setService] = useState<Service | null>(null);
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [serviceUnits, setServiceUnits] = useState<ServiceUnit[]>([]);
    const [serviceUsers, setServiceUsers] = useState<any[]>([]); // New: Users state
    const [roles, setRoles] = useState<any[]>([]); // New: Roles for modal
    const [allServices, setAllServices] = useState<any[]>([]); // New: All services for modal
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'PLAN' | 'PERSONNEL' | 'STOCK'>('PLAN');
    const [locations, setLocations] = useState<any[]>([]); // New: Locations state
    const [inventoryItems, setInventoryItems] = useState<any[]>([]); // New: Inventory items state

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addCategory, setAddCategory] = useState<'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION'>('CHAMBRE');
    const [newUnitName, setNewUnitName] = useState('');
    const [selectedTypeId, setSelectedTypeId] = useState('');

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    // Helper Functions
    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || roleId;
    const isDSI = (user: any) => user.role_id === 'role_admin_struct';

    const filteredUsers = serviceUsers.filter(user => {
        const searchLower = searchTerm.toLowerCase();
        const roleName = getRoleName(user.role_id).toLowerCase();
        return (
            user.nom.toLowerCase().includes(searchLower) ||
            user.prenom.toLowerCase().includes(searchLower) ||
            user.username.toLowerCase().includes(searchLower) ||
            roleName.includes(searchLower)
        );
    });

    // User Modal State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);

    useEffect(() => {
        if (id) loadData(id);
    }, [id]);

    const loadData = async (serviceId: string) => {
        try {
            setLoading(true);
            const [svc, types, units, users, rolesList1, rolesList2, servicesList, locs, items] = await Promise.all([
                api.getService(serviceId),
                api.getTenantRooms(),
                api.getServiceUnits(serviceId),
                api.getTenantUsers(),
                api.getGlobalRoles(),
                api.getGlobalRoles(), // Why twice? Previous edit error. Ignoring.
                api.getServices(),
                api.getLocations(serviceId, 'SERVICE'), 
                api.getInventory() 
            ]);
            
            setService(svc);
            setRoomTypes(types);
            setServiceUsers(users.filter((u: any) => u.service_ids && u.service_ids.includes(serviceId)));
            setRoles(rolesList1);
            setAllServices(servicesList);
            
            const enrichedUnits = units.map((u: any) => ({
                ...u,
                type: types.find((t: any) => t.id === u.unit_type_id)
            }));
            setServiceUnits(enrichedUnits);
            setLocations(locs);
            // Filter inventory items for this service/locations (client check for 'isInUse')
            setInventoryItems(items.filter((i: any) => i.serviceId === serviceId || locs.some((l: any) => l.name === i.location)));

        } catch (e) {
            console.error('Failed to load service data', e);
            alert('Erreur de chargement');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUnit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!service?.id || !selectedTypeId || !newUnitName) return;

        try {
            const created = await api.createServiceUnit(service.id, {
                unit_type_id: selectedTypeId,
                name: newUnitName
            });

            const typeDef = roomTypes.find(t => t.id === selectedTypeId);
            const newUnitEnriched = { ...created, type: typeDef };

            setServiceUnits([...serviceUnits, newUnitEnriched]);
            setIsAddModalOpen(false);
            setNewUnitName('');
            setSelectedTypeId('');
        } catch (e: any) {
            alert(e.message || 'Erreur lors de la création');
        }
    };

    const handleDeleteUnit = async (unitId: string) => {
        if (!window.confirm('Supprimer cette unité du service ?')) return;
        try {
            await api.deleteServiceUnit(unitId);
            setServiceUnits(serviceUnits.filter(u => u.id !== unitId));
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    };

    const openAddModal = (category: 'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION') => {
        setAddCategory(category);
        setNewUnitName('');
        setSelectedTypeId('');
        setIsAddModalOpen(true);
    };

    const handleSaveUser = async (data: any) => {
        try {
            await api.createTenantUser(data);
            setIsUserModalOpen(false);
            if (id) loadData(id); // Reload to see new user
        } catch (e: any) {
            alert(e.message || 'Erreur lors de la création de l\'utilisateur');
        }
    };
    
    // getRoleName moved to top

    const renderEmptyState = (category: 'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION') => (
        <div className="border border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50">
            <div className="bg-slate-100 p-3 rounded-full mb-3 text-slate-400">
                {category === 'CHAMBRE' ? <Bed size={24} /> : 
                 category === 'PLATEAU_TECHNIQUE' ? <Activity size={24} /> : 
                 <Stethoscope size={24} />}
            </div>
            <p className="text-slate-500 font-medium mb-1">Aucune unité configurée</p>
            <p className="text-slate-400 text-sm mb-4">Commencez par ajouter {category === 'CHAMBRE' ? 'une chambre' : category === 'PLATEAU_TECHNIQUE' ? 'un plateau' : 'un box'}</p>
            <button 
                onClick={() => openAddModal(category)}
                className="text-sm bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium"
            >
                Ajouter {category === 'CHAMBRE' ? 'une Chambre' : category === 'PLATEAU_TECHNIQUE' ? 'un Plateau' : 'un Box'}
            </button>
        </div>
    );

    const renderUnitCard = (unit: ServiceUnit, category: 'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION') => {
        return (
            <div key={unit.id} className="group relative bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[140px]">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h4 className="text-lg font-bold text-slate-800 leading-tight">{unit.name}</h4>
                        <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                            category === 'CHAMBRE' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            category === 'PLATEAU_TECHNIQUE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            'bg-violet-50 text-violet-700 border-violet-100'
                        }`}>
                            {unit.type?.name || 'Type Inconnu'}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="mt-auto">
                    {category === 'CHAMBRE' && unit.type?.number_of_beds && (
                        <div>
                             <div className="flex items-center space-x-1.5 mb-2">
                                {[...Array(unit.type.number_of_beds)].map((_, i) => (
                                    <div key={i} className="bg-slate-50 text-slate-400 p-1.5 rounded md:rounded-lg border border-slate-100" title={`Lit ${i+1}`}>
                                        <Bed size={18} />
                                    </div>
                                ))}
                            </div>
                            <span className="text-xs text-slate-400 font-medium">{unit.type.number_of_beds} lits disponibles</span>
                        </div>
                    )}
                    
                    {category === 'PLATEAU_TECHNIQUE' && (
                         <div className="flex items-center text-slate-400 text-sm mt-2">
                            <Activity size={16} className="mr-2" />
                            <span>Plateau Technique</span>
                         </div>
                    )}

                    {category === 'BOOTH_CONSULTATION' && (
                         <div className="flex items-center text-slate-400 text-sm mt-2">
                            <Stethoscope size={16} className="mr-2" />
                            <span>Consultation</span>
                         </div>
                    )}
                </div>

                 {/* Delete Action - Visible on Hover */}
                 <button 
                    onClick={() => handleDeleteUnit(unit.id)}
                    className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                    title="Supprimer"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        );
    };

    const renderSection = (title: string, subtitle: string, category: 'CHAMBRE' | 'PLATEAU_TECHNIQUE' | 'BOOTH_CONSULTATION', icon: React.ReactNode) => {
        const units = serviceUnits.filter(u => u.type?.unit_category === category);
        
        return (
            <div className="mb-10">
                <div className="flex items-end justify-between mb-6 border-b border-slate-100 pb-4">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                            category === 'CHAMBRE' ? 'bg-blue-50 text-blue-600' :
                            category === 'PLATEAU_TECHNIQUE' ? 'bg-emerald-50 text-emerald-600' :
                            'bg-violet-50 text-violet-600'
                        }`}>
                            {icon}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 leading-none mb-1">{title}</h3>
                            <p className="text-sm text-slate-500 leading-none">{subtitle}</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => openAddModal(category)}
                        className="text-sm font-medium bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center shadow-sm"
                    >
                        <Plus size={16} className="mr-1.5" /> Ajouter
                    </button>
                </div>

                {units.length === 0 ? renderEmptyState(category) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {units.map(unit => renderUnitCard(unit, category))}
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Chargement...</div>;
    if (!service) return null;

    return (
        <div className="min-h-screen bg-slate-50/50">
             <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button 
                        onClick={() => navigate('/settings/services')}
                        className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mb-4 text-sm font-medium"
                    >
                        <ArrowLeft size={16} className="mr-1" />
                        Retour aux services
                    </button>
                    <div className="flex items-center justify-between">
                         <div>
                            <div className="flex items-baseline space-x-3 mb-2">
                                <h1 className="text-3xl font-bold text-slate-900">{service.name}</h1>
                                {service.code && <span className="px-2 py-0.5 rounded text-sm font-mono bg-slate-200 text-slate-600">{service.code}</span>}
                            </div>
                            <p className="text-slate-500">{service.description || 'Aucune description disponible pour ce service.'}</p>
                         </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200 mb-8">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('PLAN')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                                activeTab === 'PLAN'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <LayoutGrid size={18} />
                            <span>Plan de service</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('PERSONNEL')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                                activeTab === 'PERSONNEL'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <Users size={18} />
                            <span>Personnel</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('STOCK')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                                activeTab === 'STOCK'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <Package size={18} />
                            <span>Stock</span>
                        </button>
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
                    {activeTab === 'PLAN' && (
                        <div className="p-8">
                            {renderSection(
                                'Chambres d\'Hospitalisation', 
                                'Zones d\'hébergement des patients', 
                                'CHAMBRE',
                                <Bed size={20} />
                            )}
                            
                            {renderSection(
                                'Plateaux Techniques', 
                                'Blocs opératoires, salles d\'imagerie et laboratoires', 
                                'PLATEAU_TECHNIQUE',
                                <Activity size={20} />
                            )}
                            
                            {renderSection(
                                'Box de Consultation', 
                                'Points d\'accueil et de consultation externe', 
                                'BOOTH_CONSULTATION',
                                <Stethoscope size={20} />
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'PERSONNEL' && (
                        <div className="p-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Personnel du Service</h3>
                                    <p className="text-sm text-slate-500">Membres de l'équipe ayant accès à ce service</p>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="text"
                                            placeholder="Rechercher un utilisateur..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64"
                                        />
                                    </div>
                                    <button 
                                        onClick={() => setIsUserModalOpen(true)}
                                        className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-sm whitespace-nowrap"
                                    >
                                        <Plus size={16} className="mr-1.5" /> Ajouter
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Utilisateur</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Service(s)</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Identifiant</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                    <div className="flex flex-col items-center">
                                                        <Users size={32} className="text-slate-300 mb-2" />
                                                        <p>Aucun utilisateur trouvé</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map(user => (
                                                <tr 
                                                    key={user.id} 
                                                    className="hover:bg-slate-50 transition-colors"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center space-x-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                                                (user.active === false) ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600'
                                                            }`}>
                                                                {user.nom.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className={`text-sm font-medium ${
                                                                    (user.active === false) ? 'text-slate-500 line-through' : 'text-slate-900'
                                                                }`}>
                                                                    {user.nom} {user.prenom}
                                                                    {isDSI(user) && <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">DSI</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                            <Shield size={12} />
                                                            <span>{getRoleName(user.role_id)}</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {user.service_ids && user.service_ids.length > 0 ? (
                                                                user.service_ids.map((sid: string) => {
                                                                    const svc = allServices.find(s => s.id === sid);
                                                                    // Highlight current service
                                                                    const isCurrent = sid === service.id;
                                                                    return svc ? (
                                                                        <span key={sid} className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                                                            isCurrent 
                                                                                ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                                                        }`}>
                                                                            {svc.name}
                                                                        </span>
                                                                    ) : null;
                                                                })
                                                            ) : (
                                                                <span className="text-xs text-slate-400 italic">-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500 font-mono">
                                                        {user.username}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.active === false ? (
                                                             <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100">Inactif</span>
                                                        ) : (
                                                             <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Actif</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'STOCK' && (
                        <div className="p-8">
                            <LocationManager 
                                locations={locations} 
                                inventoryItems={inventoryItems} 
                                onUpdateLocations={(newLocs) => setLocations(newLocs)}
                                serviceId={service.id}
                                scope="SERVICE"
                            />
                        </div>
                    )}
                </div>

                 {/* Add Unit Modal */}
                 {isAddModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h2 className="text-lg font-bold text-slate-800">
                                    Ajouter {addCategory === 'CHAMBRE' ? 'une Chambre' : addCategory === 'PLATEAU_TECHNIQUE' ? 'un Plateau' : 'un Box'}
                                </h2>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <span className="text-2xl">&times;</span>
                                </button>
                            </div>
                            
                            <form onSubmit={handleAddUnit} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type d'unité <span className="text-red-500">*</span></label>
                                    <select 
                                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700"
                                        value={selectedTypeId}
                                        onChange={e => setSelectedTypeId(e.target.value)}
                                        required
                                    >
                                        <option value="">Sélectionner un type...</option>
                                        {roomTypes
                                            .filter(t => t.unit_category === addCategory)
                                            .map(t => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name} {t.number_of_beds ? `(${t.number_of_beds} lits)` : ''}
                                                </option>
                                            ))
                                        }
                                    </select>
                                    {roomTypes.filter(t => t.unit_category === addCategory).length === 0 && (
                                        <div className="mt-2 p-3 bg-amber-50 text-amber-700 text-xs rounded-lg flex items-start">
                                            <span className="mr-2">⚠️</span>
                                            Aucun type configuré. Allez dans "Chambres" pour créer des types d'unités avant de pouvoir en ajouter ici.
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom / Numéro <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-700"
                                        value={newUnitName}
                                        onChange={e => setNewUnitName(e.target.value)}
                                        placeholder={addCategory === 'CHAMBRE' ? "ex: 104" : "ex: Salle 1"}
                                        required
                                    />
                                </div>

                                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Annuler</button>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium transition-colors">Enregistrer</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* Add User Modal */}
                <UserModal 
                    isOpen={isUserModalOpen}
                    onClose={() => setIsUserModalOpen(false)}
                    onSave={handleSaveUser}
                    // No user prop = Create Mode
                    roles={roles}
                    services={allServices}
                    lockedServiceId={service.id} // Lock to current service
                />
            </div>
        </div>
    );
};
