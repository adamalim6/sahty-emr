import React, { useState } from 'react';
import { ObservationPanelPlaceholder, PrescriptionPanelPlaceholder, DiagnosticPanelPlaceholder } from './PanelPlaceholders';

import { ObservationRecord } from './Observations';
import { ObservationEditorPanel } from './ObservationEditorPanel';

export type RightPanelTab = 'obs' | 'presc' | 'diag';

interface RightChartPanelProps {
  isOpen: boolean;
  width: number;
  activeTab: RightPanelTab | null;
  onClose: () => void;
  setWidth: (w: number) => void;
  
  // Observation Editor Props
  patientId: string;
  obsEditorMode: 'CREATE' | 'EDIT' | 'VIEW' | 'ADDENDUM';
  activeObsNote: Partial<ObservationRecord> | null;
  obsParentNote: ObservationRecord | null;
  isSavingObs: boolean;
  setActiveObsNote: (note: Partial<ObservationRecord> | null) => void;
  setIsSavingObs: (saving: boolean) => void;
  onObsSaveSuccess: () => void;
  onObsDiscard: () => void;
  onOpenSmartPhrases?: (payload?: any) => void;
}

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 560;

function clampWidth(w: number) {
  return Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, w));
}

export const RightChartPanel: React.FC<RightChartPanelProps> = ({ 
  isOpen, width, activeTab, onClose, setWidth,
  patientId, obsEditorMode, activeObsNote, obsParentNote, isSavingObs,
  setActiveObsNote, setIsSavingObs, onObsSaveSuccess, onObsDiscard, onOpenSmartPhrases
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Dragging left increases width, dragging right decreases width
      const delta = startX - moveEvent.clientX; 
      const newWidth = startWidth + delta;
      
      const clamped = clampWidth(newWidth);
      setWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div 
      className={`shrink-0 bg-white relative flex flex-col h-full overflow-hidden ${isOpen ? 'border-l border-slate-200' : 'border-none'} ${isDragging ? '' : 'transition-[width] duration-200 ease-out'}`}
      style={{ width: isOpen ? `${width}px` : '0px' }}
    >
      {/* Invisible Resize Handle on the left edge */}
      {isOpen && (
        <div 
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-[4px] cursor-col-resize z-50 hover:bg-slate-300/50 active:bg-slate-400/50 transition-colors"
        />
      )}

      <div className="h-full relative overflow-hidden" style={{ width: `${width}px` }}> 
        {isOpen && activeTab === 'obs' && (
          <ObservationEditorPanel 
            patientId={patientId}
            mode={obsEditorMode}
            activeNote={activeObsNote}
            parentNoteForAddendum={obsParentNote}
            isSaving={isSavingObs}
            setActiveNote={setActiveObsNote}
            setIsSaving={setIsSavingObs}
            onClose={onClose}
            onDiscard={onObsDiscard}
            onSaveSuccess={onObsSaveSuccess}
            onOpenSmartPhrases={onOpenSmartPhrases}
          />
        )}
        {isOpen && activeTab === 'presc' && <PrescriptionPanelPlaceholder onClose={onClose} />}
        {isOpen && activeTab === 'diag' && <DiagnosticPanelPlaceholder onClose={onClose} />}
      </div>
    </div>
  );
};
