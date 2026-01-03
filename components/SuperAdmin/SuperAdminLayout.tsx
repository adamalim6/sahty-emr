
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, Shield, LogOut, Building, Truck } from 'lucide-react';
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
                    <NavLink to="/super-admin/organismes" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Building size={20} />
                        <span>Organismes</span>
                    </NavLink>
                    <NavLink to="/super-admin/actes" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <FileText size={20} />
                        <span>Référentiel Actes</span>
                    </NavLink>
                    <NavLink to="/super-admin/roles" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Shield size={20} />
                        <span>Global Roles</span>
                    </NavLink>
                    <NavLink to="/super-admin/suppliers" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <Truck size={20} />
                        <span>Fournisseurs</span>
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
