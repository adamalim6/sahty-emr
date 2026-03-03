
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, Shield, LogOut, Building, Truck, Package, FolderTree, Activity, Layers, Tag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const SuperAdminLayout: React.FC = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="flex h-screen bg-slate-100">
            {/* Sidebar */}
            <div className="w-64 bg-slate-900 text-white flex flex-col">
                <div className="p-6 border-b border-slate-700">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Super Admin
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">Publisher Access Only</p>
                </div>
                
                <nav className="flex-1 p-4 space-y-2">
                    <NavLink to="/super-admin/clients" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Users size={20} />
                        <span>Clients / Tenants</span>
                    </NavLink>
                    <NavLink to="/super-admin/groups" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <FolderTree size={20} />
                        <span>Groupes</span>
                    </NavLink>
                    <NavLink to="/super-admin/organismes" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Building size={20} />
                        <span>Organismes</span>
                    </NavLink>
                    <NavLink to="/super-admin/actes" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <FileText size={20} />
                        <span>Référentiel Actes</span>
                    </NavLink>
                    <NavLink to="/super-admin/familles" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <FolderTree size={16} className="ml-2" />
                        <span className="text-sm">Actes: Familles</span>
                    </NavLink>
                    <NavLink to="/super-admin/sous-familles" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Layers size={16} className="ml-2" />
                        <span className="text-sm">Actes: Sous-Familles</span>
                    </NavLink>
                    <NavLink to="/super-admin/roles" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Shield size={20} />
                        <span>Global Roles</span>
                    </NavLink>
                    <NavLink to="/super-admin/flowsheets" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Activity size={20} />
                        <span>Fiches de Surveillance</span>
                    </NavLink>
                    <NavLink to="/super-admin/units" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Layers size={20} />
                        <span>Unités</span>
                    </NavLink>
                    <NavLink to="/super-admin/routes" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <div className="w-5 h-5 flex items-center justify-center">
                            {/* Direction/Route icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 8-4 4 4 4"/><path d="M16 12H8"/></svg>
                        </div>
                        <span>Voies d'administration</span>
                    </NavLink>
                    <NavLink to="/super-admin/suppliers" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Truck size={20} />
                        <span>Fournisseurs</span>
                    </NavLink>
                    <NavLink to="/super-admin/care-categories" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Tag size={20} />
                        <span>Classes Thérapeutiques</span>
                    </NavLink>
                    <NavLink to="/super-admin/products" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Package size={20} />
                        <span>Produits</span>
                    </NavLink>
                    <NavLink to="/super-admin/dci" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <div className="w-5 h-5 flex items-center justify-center">
                            {/* Using flask icon or similar */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31"/><path d="M14 2v7.31"/><path d="M8.5 2h7"/><path d="M7 16h10"/><path d="M20 22a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2l2.4-9.6A2 2 0 0 1 8.35 11h7.3a2 2 0 0 1 1.95 1.4z"/></svg> 
                        </div>
                        <span>Référentiel DCI</span>
                    </NavLink>
                    <NavLink to="/super-admin/atc-sandbox" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    {/* Network / Hierarchy icon */}
                        <div className="w-5 h-5 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </div>
                        <span>Classification ATC</span>
                    </NavLink>
                    <NavLink to="/super-admin/emdn" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <div className="w-5 h-5 flex items-center justify-center">
                            {/* DNA / Structure icon */}
                           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M7 12a1 1 0 0 0-1-1H3v2h3a1 1 0 0 0 1-1Z"></path><path d="M17 12a1 1 0 0 1 1-1h3v2h-3a1 1 0 0 1-1-1Z"></path><path d="M12 7a1 1 0 0 1-1-1V3h2v3a1 1 0 0 1-1 1Z"></path><path d="M12 17a1 1 0 0 0-1 1v3h2v-3a1 1 0 0 0-1-1Z"></path></svg>
                        </div>
                        <span>Classification EMDN</span>
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-slate-700">
                    <div className="flex items-center space-x-3 px-4 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold">
                            {user?.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">{user?.username}</p>
                            <p className="text-xs text-slate-500 truncate">Super Admin</p>
                        </div>
                    </div>
                    <button 
                        onClick={logout}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <LogOut size={18} />
                        <span>Déconnexion</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <Outlet />
            </div>
        </div>
    );
};
