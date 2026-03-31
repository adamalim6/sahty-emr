import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Settings, FolderTree, Layers, Beaker, LogOut, ChevronLeft, ChevronRight, Menu, UserPlus, Droplet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LIMSLayout = () => {
    const { logout } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <div className={`bg-white border-r border-slate-200 flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out relative ${isCollapsed ? 'w-16' : 'w-64'}`}>
                
                {/* Toggle Button */}
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-6 bg-white border border-slate-200 rounded-full p-1 text-slate-400 hover:text-slate-600 shadow-sm z-10"
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                <div className={`p-4 border-b border-slate-200 flex items-center ${isCollapsed ? 'justify-center px-0' : ''}`}>
                    <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>
                        <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">LIMS Régional</h2>
                        <p className="text-xs text-slate-500 whitespace-nowrap">Configuration Laboratoire</p>
                    </div>
                    {isCollapsed && (
                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold font-serif shrink-0">
                            L
                        </div>
                    )}
                </div>
                
                <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar overflow-x-hidden">
                    <NavLink 
                        to="/lims/registration" 
                        title="Enregistrement"
                        className={({isActive}) => `flex items-center space-x-3 py-2 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-3'} ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <UserPlus size={18} className="shrink-0" />
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>Enregistrement</span>
                    </NavLink>

                    <NavLink 
                        to="/lims/collection" 
                        title="Prélèvement"
                        className={({isActive}) => `flex items-center space-x-3 py-2 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-3'} ${isActive ? 'bg-rose-50 text-rose-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <Droplet size={18} className="shrink-0" />
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>Prélèvement</span>
                    </NavLink>

                    <NavLink 
                        to="/lims/patients" 
                        title="Patients"
                        className={({isActive}) => `flex items-center space-x-3 py-2 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-3'} ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <Menu size={18} className="shrink-0" />
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>Patients</span>
                    </NavLink>

                    {!isCollapsed && (
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 mt-4">
                            Configuration
                        </div>
                    )}

                    <NavLink 
                        to="/lims/parametres" 
                        title="Paramètres (Contextes)"
                        className={({isActive}) => `flex items-center space-x-3 py-2 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-3'} ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <Settings size={18} className="shrink-0" />
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>Paramètres (Contextes)</span>
                    </NavLink>

                    <NavLink 
                        to="/lims/chapitres" 
                        title="Chapitres"
                        className={({isActive}) => `flex items-center space-x-3 py-2 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-3'} ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <FolderTree size={18} className="shrink-0" />
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>Chapitres</span>
                    </NavLink>

                    <NavLink 
                        to="/lims/sous-chapitres" 
                        title="Sous-chapitres"
                        className={({isActive}) => `flex items-center space-x-3 py-2 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-3'} ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <Layers size={18} className="shrink-0" />
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>Sous-chapitres</span>
                    </NavLink>

                    <NavLink 
                        to="/lims/actes-biologiques" 
                        title="Actes Biologiques"
                        className={({isActive}) => `flex items-center space-x-3 py-2 rounded-lg transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-3'} ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                        <Beaker size={18} className="shrink-0" />
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>Actes Biologiques</span>
                    </NavLink>
                </nav>

                {/* Logout Button */}
                <div className={`p-4 border-t border-slate-200 mt-auto ${isCollapsed ? 'px-2' : ''}`}>
                    <button
                        onClick={logout}
                        title="Déconnexion"
                        className={`flex items-center space-x-3 w-full py-2 rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors ${isCollapsed ? 'px-0 justify-center' : 'px-3'}`}
                    >
                        <LogOut size={18} className="shrink-0" />
                        <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>Déconnexion</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Outlet />
            </div>
        </div>
    );
};
