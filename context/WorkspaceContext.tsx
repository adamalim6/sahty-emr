import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export interface WorkspaceTab {
  workspaceId: string;
  patientId: string;
  label: string;
  activeDossierTab: string;
  lastVisitedAt: number;
}

interface WorkspaceContextType {
  workspaceTabs: WorkspaceTab[];
  activeWorkspaceId: string | null;
  openWorkspace: (patientId: string) => void;
  closeWorkspace: (workspaceId: string) => void;
  updateWorkspaceLabel: (workspaceId: string, label: string) => void;
  updateActiveDossierTab: (workspaceId: string, dossierTabId: string) => void;
  isPatientRoute: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const isPatientRoute = location.pathname.startsWith('/patient/');

  const workspaceTabsRef = useRef(workspaceTabs);
  useEffect(() => { workspaceTabsRef.current = workspaceTabs; }, [workspaceTabs]);
  
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  useEffect(() => { activeWorkspaceIdRef.current = activeWorkspaceId; }, [activeWorkspaceId]);

  // Sync route changes into Workspace state
  useEffect(() => {
    if (location.pathname.startsWith('/patient/')) {
      const patientId = location.pathname.split('/')[2];
      if (patientId) {
        const currentTabs = workspaceTabsRef.current;
        const currentActiveId = activeWorkspaceIdRef.current;
        
        const existingTab = currentTabs.find(t => t.patientId === patientId);
        
        if (existingTab) {
          // Patient is already open
          if (currentActiveId !== existingTab.workspaceId) {
            setActiveWorkspaceId(existingTab.workspaceId);
            activeWorkspaceIdRef.current = existingTab.workspaceId; // Sync immediately
          }
          // Bump lastVisitedAt
          setWorkspaceTabs(prev => 
            prev.map(t => t.workspaceId === existingTab.workspaceId 
              ? { ...t, lastVisitedAt: Date.now() } 
              : t
            )
          );
        } else {
          // New Patient Open Request
          if (currentTabs.length >= 5) {
            toast.error("Maximum de 5 dossiers patients ouverts atteint. Veuillez en fermer un avant d'en ouvrir un autre.");
            // Prevent the invalid navigation by forcing route back to highest recent tab, or home
            if (currentActiveId) {
              const activeTab = currentTabs.find(t => t.workspaceId === currentActiveId);
              navigate(activeTab ? `/patient/${activeTab.patientId}` : '/patients', { replace: true });
            } else {
              navigate('/patients', { replace: true });
            }
          } else {
            // Allocate new tab
            const newWsId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const newTab: WorkspaceTab = {
              workspaceId: newWsId,
              patientId,
              label: 'Chargement...',
              // Defaults to Parcours tab like PatientDossier does currently
              activeDossierTab: 'Parcours',
              lastVisitedAt: Date.now()
            };
            
            // Fix: Synchronously update the refs to prevent React StrictMode from double-allocating tabs 
            // before the first state update propagates to the effect dependencies.
            workspaceTabsRef.current = [...currentTabs, newTab];
            activeWorkspaceIdRef.current = newWsId;
            
            setWorkspaceTabs(prev => {
              // Safety check: if somehow it's already queued, don't forcefully duplicate it
              if (prev.some(t => t.patientId === patientId)) return prev;
              return [...prev, newTab];
            });
            setActiveWorkspaceId(newWsId);
          }
        }
      }
    }
  }, [location.pathname, navigate]);

  const openWorkspace = useCallback((patientId: string) => {
    navigate(`/patient/${patientId}`);
  }, [navigate]);

  const closeWorkspace = useCallback((workspaceId: string) => {
    const currentTabs = workspaceTabsRef.current;
    const currentActiveId = activeWorkspaceIdRef.current;
    
    const newTabs = currentTabs.filter(t => t.workspaceId !== workspaceId);
    setWorkspaceTabs(newTabs);
    
    if (currentActiveId === workspaceId) {
      // Closing the active tab triggers navigation
      if (newTabs.length > 0) {
        // Find most recently visited
        const nextTab = newTabs.reduce((latest, current) => 
          current.lastVisitedAt > latest.lastVisitedAt ? current : latest
        , newTabs[0]);
        navigate(`/patient/${nextTab.patientId}`);
      } else {
        // Last tab closed
        setActiveWorkspaceId(null);
        navigate('/patients');
      }
    }
  }, [navigate]);

  const updateWorkspaceLabel = useCallback((workspaceId: string, label: string) => {
    setWorkspaceTabs(prev => 
      prev.map(t => t.workspaceId === workspaceId ? { ...t, label } : t)
    );
  }, []);

  const updateActiveDossierTab = useCallback((workspaceId: string, dossierTabId: string) => {
    setWorkspaceTabs(prev => 
      prev.map(t => t.workspaceId === workspaceId ? { ...t, activeDossierTab: dossierTabId } : t)
    );
  }, []);

  return (
    <WorkspaceContext.Provider value={{
      workspaceTabs,
      activeWorkspaceId,
      openWorkspace,
      closeWorkspace,
      updateWorkspaceLabel,
      updateActiveDossierTab,
      isPatientRoute
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
