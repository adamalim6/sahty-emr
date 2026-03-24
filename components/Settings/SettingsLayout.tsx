
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, LayoutGrid, BedDouble, DollarSign, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const SettingsLayout: React.FC = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="flex h-screen bg-slate-100">
            {/* Sidebar */}
            <div className="w-64 bg-slate-800 text-white flex flex-col">
                <div className="p-6 border-b border-slate-700">
                    <h1 className="text-xl font-bold text-blue-400">
                        Paramétrage
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">Tenant Administration</p>
                </div>
                
                <nav className="flex-1 p-4 space-y-2">
                    <NavLink to="/settings/users" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                        <Users size={20} />
                        <span>Utilisateurs</span>
                    </NavLink>
                    <NavLink to="/settings/services" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                        <LayoutGrid size={20} />
                        <span>Services</span>
                    </NavLink>
                    <NavLink to="/settings/rooms" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                        <BedDouble size={20} />
                        <span>Chambres</span>
                    </NavLink>
                    <NavLink to="/settings/pricing" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                        <DollarSign size={20} />
                        <span>Actes & Prix</span>
                    </NavLink>
                    <NavLink to="/settings/roles" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                        <Shield size={20} />
                        <span>Roles (Global)</span>
                    </NavLink>
                    <NavLink to="/settings/smart-phrases" className={({isActive}) => `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                        {/* Use FileText or similar. Importing from lucide-react should work if it's there. Just use a generic icon class for now since FileText isn't imported from lucide-react in this exact block, wait let's check top of file. */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                        <span>Smart Phrases</span>
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-slate-700">
                    <div className="flex items-center space-x-3 px-4 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold">
                            {user?.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">{user?.username}</p>
                            <p className="text-xs text-slate-500 truncate">Tenant Admin</p>
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
