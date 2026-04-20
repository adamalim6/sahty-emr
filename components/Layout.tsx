
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  ClipboardList,
  Calendar,
  Armchair,
  Map,
  Settings,
  Activity,
  Menu,
  X,
  Bot,
  LogOut,
  MapPin,
  Pill,
  Package,
  FileText,
  RotateCcw,
  Bell,
  ShieldCheck
} from 'lucide-react';
import { AIAssistant } from './AIAssistant';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PAGE_REGISTRY } from '../constants/pageRegistry';
import { useWorkspace } from '../context/WorkspaceContext';
import { PatientDossier } from './PatientDossier/PatientDossier';

interface LayoutProps {
  children: React.ReactNode;
}

export type SidebarState = 'expanded' | 'collapsed';

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const { workspaceTabs, activeWorkspaceId, isPatientRoute, openWorkspace, closeWorkspace, sidebarState, setSidebarState } = useWorkspace();

  // Helper to find page definition by ID
  const getPageInfo = (pageId: string) => {
    for (const module of PAGE_REGISTRY) {
        const page = module.pages.find(p => p.id === pageId);
        if (page) return page;
    }
    return null;
  };

  // Define navigation items with their Permission Key (Page ID)
  const availableNavItems = [
    { id: 'emr_patients', icon: Users, label: 'Patients', to: '/' },
    { id: 'emr_admissions', icon: ClipboardList, label: 'Admissions', to: '/admissions' },
    { id: 'emr_coverages', icon: ShieldCheck, label: 'Couvertures', to: '/coverages' },
    { id: 'emr_replenishment', icon: ClipboardList, label: 'Réapprovisionnement', to: '/replenishment' },
    { id: 'emr_service_stock', icon: Package, label: 'Stock Service', to: '/service-stock' },
    { id: 'emr_returns', icon: RotateCcw, label: 'Retours', to: '/retours' },
    { id: 'emr_waiting_room', icon: Armchair, label: 'Salle d\'Attente', to: '/waiting-room' },
    { id: 'emr_map', icon: Map, label: 'Plan du Service', to: '/map' },
    { id: 'emr_calendar', icon: Calendar, label: 'Agenda', to: '/calendar' },
    // Settings usually available to all logged in users, or guarded separately
    { id: 'st_users', icon: Settings, label: 'Paramètres', to: '/profile' } // Using a safe default or mapped ID
  ];

  // Filter based on user permissions
  console.log('[Layout] User permissions:', user?.permissions);
  console.log('[Layout] Looking for emr_returns?', user?.permissions?.includes('emr_returns'));
  const filteredNavItems = availableNavItems.filter(item => {
    if (!user) return false;
    // Super Admin Bypass (optional, but good for testing)
    if (user.user_type === 'PUBLISHER_SUPERADMIN') return true;
    
    // Check if user has the specific permission
    // For 'Settings', we might allow it generically, but strict check is better
    if (item.id === 'st_users') return true; // Profile/Settings usually open to self

    return (user.permissions || []).includes(item.id);
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 bg-slate-900 text-white transform transition-[width,transform] duration-300 ease-in-out shrink-0 flex flex-col
        ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'}
        lg:relative lg:translate-x-0
        ${sidebarState === 'collapsed' ? 'lg:w-16' : 'lg:w-64'}
      `}>
        <div className={`flex items-center p-6 border-b border-slate-700 shrink-0 h-16 transition-all duration-300 ${sidebarState === 'collapsed' ? 'justify-center px-0' : 'justify-between'}`}>
          <div className="flex items-center space-x-2 overflow-hidden">
            <Activity className="h-8 w-8 text-emerald-400 shrink-0" />
            <span className={`text-xl font-bold tracking-tight whitespace-nowrap transition-all duration-300 ${sidebarState === 'collapsed' ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>Sahty EMR</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className={`lg:hidden text-slate-400 hover:text-white shrink-0 ${sidebarState === 'collapsed' ? 'hidden' : ''}`}>
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 space-y-2 overflow-y-auto flex-1 custom-scrollbar px-2">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center py-3 rounded-lg transition-colors
                ${sidebarState === 'collapsed' ? 'justify-center px-0' : 'justify-start px-4'}
                ${isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }
              `}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${sidebarState === 'collapsed' ? 'mr-0' : 'mr-3'}`} />
              <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarState === 'collapsed' ? 'opacity-0 w-0 h-0 hidden' : 'opacity-100 w-auto'}`}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 shrink-0 border-t border-slate-800">
          <div className={`bg-slate-800 rounded-xl flex items-center transition-all duration-300 ${sidebarState === 'collapsed' ? 'p-2 flex-col space-y-4 justify-center' : 'p-4 justify-between'}`}>
            <div className={`flex items-center ${sidebarState === 'collapsed' ? 'space-x-0' : 'space-x-3'}`}>
              <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                {user?.prenom?.charAt(0) || 'U'}
              </div>
              <div className={`overflow-hidden transition-all duration-300 ${sidebarState === 'collapsed' ? 'opacity-0 w-0 hidden' : 'opacity-100 w-auto'}`}>
                <p className="text-sm font-semibold truncate">{user?.nom} {user?.prenom}</p>
                <p className="text-xs text-slate-400 truncate">{user?.username}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="text-slate-400 hover:text-white p-2 shrink-0 transition-colors"
              title="Se déconnecter"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50 min-w-0">
        {/* Workspace Bar (48px) */}
        <header className="bg-white border-b border-gray-200 h-12 flex items-end justify-between px-4 shrink-0 transition-all duration-300 z-20 relative pt-2">
          
          {/* LEFT ZONE: Burger Toggles */}
          <div className="flex items-center gap-2 shrink-0 w-32 pb-1.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <Menu size={20} />
            </button>
            <button
              onClick={() => setSidebarState(sidebarState === 'expanded' ? 'collapsed' : 'expanded')}
              className="hidden lg:flex p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              title="Basculer le menu"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* CENTER ZONE: Workspace Tabs */}
          <div className="flex-1 flex items-end overflow-x-auto scrollbar-none px-2 space-x-1 h-full -mb-px">
            {workspaceTabs.map(tab => (
              <div 
                key={tab.workspaceId}
                onClick={() => tab.type === 'utility' && tab.route ? navigate(tab.route) : openWorkspace(tab.patientId as string)}
                title={tab.label}
                className={`group flex items-center justify-between h-[36px] px-3 border border-b-0 rounded-t-md text-sm select-none cursor-pointer transition-colors shrink-0 min-w-[120px] max-w-[160px]
                  ${activeWorkspaceId === tab.workspaceId 
                    ? 'bg-white border-gray-200 text-gray-900 font-medium z-10' 
                    : 'bg-slate-100 border-transparent text-gray-500 hover:bg-slate-200 hover:text-gray-700'
                  }`}
              >
                <span className="truncate pr-2 pointer-events-none">{tab.label}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); closeWorkspace(tab.workspaceId); }}
                  className={`p-0.5 rounded-sm transition-colors shrink-0
                    ${activeWorkspaceId === tab.workspaceId ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-300'}
                  `}
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>

          {/* RIGHT ZONE: Controls */}
          <div className="flex items-center justify-end gap-2 shrink-0 w-32 pb-1.5">
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center justify-center p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
              title="Assistant IA"
            >
              <Bot size={20} />
            </button>
            <button
              className="flex items-center justify-center p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              title="Notifications"
            >
              <Bell size={20} />
            </button>
          </div>
        </header>

        {/* Workspace & Routing Content */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* 1. The Keep-Alive Patient Workspaces Collection */}
          <div className={`absolute inset-0 bg-white ${isPatientRoute || location.pathname === '/templates' ? 'block z-10' : 'hidden z-0'}`}>
            {workspaceTabs.map(tab => {
               if (tab.type === 'utility') {
                 return (
                   <div 
                     key={tab.workspaceId}
                     className="absolute inset-0 overflow-auto bg-slate-50"
                     style={{ display: activeWorkspaceId === tab.workspaceId ? 'block' : 'none' }}
                   >
                     <div className="w-full h-full p-6 md:p-8">
                        {children}
                     </div>
                   </div>
                 );
               }
               return (
                 <div 
                   key={tab.workspaceId}
                   className="absolute inset-0"
                   style={{ display: activeWorkspaceId === tab.workspaceId ? 'block' : 'none' }}
                 >
                   <PatientDossier 
                     patientId={tab.patientId as string} 
                     workspaceId={tab.workspaceId} 
                     isActiveWorkspace={activeWorkspaceId === tab.workspaceId} 
                   />
                 </div>
               );
            })}
          </div>

          {/* 2. The Root Navigation Outlet (Admissions, Settings, etc.) */}
          <div className={`absolute inset-0 overflow-auto bg-slate-50 ${!isPatientRoute && location.pathname !== '/templates' ? 'block z-10' : 'hidden z-0'}`}>
            <div className="w-full p-6 md:p-8">
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* AI Assistant Drawer */}
      <AIAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
};
