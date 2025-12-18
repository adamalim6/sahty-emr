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
  LogOut
} from 'lucide-react';
import { AIAssistant } from './AIAssistant';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Patients', icon: Users },
    { to: '/admissions', label: 'Admissions', icon: ClipboardList },
    { to: '/calendar', label: 'Calendrier', icon: Calendar },
    { to: '/waiting-room', label: 'Salle d\'Attente', icon: Armchair },
    { to: '/map', label: 'Plan du Service', icon: Map },
    { to: '/settings', label: 'Paramètres', icon: Settings },
  ];

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
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <Activity className="h-8 w-8 text-emerald-400" />
            <span className="text-xl font-bold tracking-tight">Sahty EMR</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 px-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center px-4 py-3 rounded-lg transition-colors
                ${isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <item.icon className="h-5 w-5 mr-3" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-6 left-0 right-0 px-4">
          <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                DR
              </div>
              <div>
                <p className="text-sm font-semibold">Dr. S. Alami</p>
                <p className="text-xs text-slate-400">Cardiologue</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="text-slate-400 hover:text-white p-2"
              title="Se déconnecter"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 lg:px-10 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <Menu size={24} />
          </button>

          <h1 className="text-xl font-semibold text-gray-800 hidden lg:block">
            Système de Gestion Hospitalière
          </h1>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Bot size={18} />
              <span className="hidden sm:inline">Assistant IA</span>
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-auto p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* AI Assistant Drawer */}
      <AIAssistant isOpen={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
};
