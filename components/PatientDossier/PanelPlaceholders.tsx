import React from 'react';
import { X, FileText, Pill, Microscope } from 'lucide-react';

interface PlaceholderProps {
  onClose: () => void;
  title: string;
  icon: any;
}

const PanelPlaceholder: React.FC<PlaceholderProps> = ({ onClose, title, icon: Icon }) => (
  <div className="flex flex-col h-full bg-slate-50">
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
      <div className="flex items-center space-x-2 text-indigo-700">
        <Icon size={18} />
        <h3 className="font-bold text-sm tracking-wide uppercase">{title}</h3>
      </div>
      <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
        <X size={18} />
      </button>
    </div>
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
      <Icon size={48} className="mb-4 opacity-20" />
      <p className="text-sm font-medium">Éditeur {title} à venir (Phase 4)</p>
      <p className="text-xs mt-2">L'interface clinique sera implémentée lors de la prochaine phase.</p>
    </div>
  </div>
);

export const ObservationPanelPlaceholder: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <PanelPlaceholder onClose={onClose} title="Observations" icon={FileText} />
);

export const PrescriptionPanelPlaceholder: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <PanelPlaceholder onClose={onClose} title="Prescriptions" icon={Pill} />
);

export const DiagnosticPanelPlaceholder: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <PanelPlaceholder onClose={onClose} title="Diagnostic" icon={Microscope} />
);
