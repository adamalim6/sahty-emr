import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// ============================================================
// Workspace tab model — first-class types: patient | admission | utility
// ============================================================
//
// Tab identity is content-addressed (`${type}:${entityId}` for patient/admission,
// `utility:<slug>` for utility) so opening the same entity twice resolves to the
// same tab regardless of entry point. Legacy fields (workspaceId, patientId,
// label, activeDossierTab) are kept as aliases so Layout / PatientDossier can
// migrate incrementally without breaking.

export type WorkspaceTabType = 'patient' | 'admission' | 'utility';

export interface WorkspaceTab {
    // --- Identity (primary) ---
    id: string;                        // content-addressed unique key
    type: WorkspaceTabType;
    entityId?: string;                 // patientId or admissionId; undefined for utility

    // --- Display ---
    title: string;                     // short label shown on tab
    subtitle?: string;                 // longer context (e.g., admission tab shows patient name)
    route: string;                     // canonical URL for this tab

    // --- State ---
    activeInnerTab?: string;           // inner dossier tab memory (patient / admission dossier sub-tabs)
    lastVisitedAt: number;             // MRU ordering
    createdAt: number;
    closable: boolean;
    initialPayload?: any;

    // --- Legacy aliases (do NOT read from these in new code; will be removed after migration) ---
    workspaceId: string;               // = id
    patientId?: string;                // = entityId when type === 'patient'
    label: string;                     // = title
    activeDossierTab?: string;         // = activeInnerTab
}

// ============================================================
// Open tab inputs (discriminated union)
// ============================================================

export type OpenTabInput =
    | { type: 'patient'; patientId: string; title?: string; subtitle?: string }
    | { type: 'admission'; admissionId: string; title?: string; subtitle?: string }
    | { type: 'utility'; slug: string; title: string; route: string; payload?: any };

// ============================================================
// Context
// ============================================================

interface WorkspaceContextType {
    // --- New primary API ---
    tabs: WorkspaceTab[];
    activeTabId: string | null;
    openTab: (input: OpenTabInput) => void;
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
    updateTabMeta: (id: string, patch: Partial<Pick<WorkspaceTab, 'title' | 'subtitle' | 'activeInnerTab'>>) => void;
    clearTabPayload: (id: string) => void;

    // --- Legacy API (delegates to the new one; kept for incremental migration) ---
    workspaceTabs: WorkspaceTab[];
    activeWorkspaceId: string | null;
    openWorkspace: (patientId: string) => void;
    openUtilityTab: (utilityId: string, label: string, route: string, initialPayload?: any) => void;
    closeWorkspace: (workspaceId: string) => void;
    updateWorkspaceLabel: (workspaceId: string, label: string) => void;
    updateActiveDossierTab: (workspaceId: string, dossierTabId: string) => void;
    isPatientRoute: boolean;

    // --- Sidebar ---
    sidebarState: 'expanded' | 'collapsed';
    setSidebarState: React.Dispatch<React.SetStateAction<'expanded' | 'collapsed'>>;
}

export const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const MAX_TABS = 5;

// Pure helper — build a tab from an OpenTabInput, without touching state.
function buildTab(input: OpenTabInput): WorkspaceTab {
    const now = Date.now();
    if (input.type === 'patient') {
        const id = `patient:${input.patientId}`;
        return {
            id,
            type: 'patient',
            entityId: input.patientId,
            title: input.title || 'Chargement...',
            subtitle: input.subtitle,
            route: `/patient/${input.patientId}`,
            activeInnerTab: 'Parcours',
            lastVisitedAt: now,
            createdAt: now,
            closable: true,
            // legacy aliases
            workspaceId: id,
            patientId: input.patientId,
            label: input.title || 'Chargement...',
            activeDossierTab: 'Parcours',
        };
    }
    if (input.type === 'admission') {
        const id = `admission:${input.admissionId}`;
        return {
            id,
            type: 'admission',
            entityId: input.admissionId,
            title: input.title || 'Admission',
            subtitle: input.subtitle,
            route: `/admission/${input.admissionId}`,
            lastVisitedAt: now,
            createdAt: now,
            closable: true,
            // legacy aliases
            workspaceId: id,
            label: input.title || 'Admission',
        };
    }
    // utility
    const id = `utility:${input.slug}`;
    return {
        id,
        type: 'utility',
        title: input.title,
        route: input.route,
        lastVisitedAt: Date.now(),
        createdAt: Date.now(),
        closable: true,
        initialPayload: input.payload,
        // legacy aliases
        workspaceId: id,
        label: input.title,
    };
}

// Parse current URL into an OpenTabInput (null if the URL is not tab-bound, e.g. a list page).
function routeToOpenInput(pathname: string): OpenTabInput | null {
    if (pathname.startsWith('/patient/')) {
        const patientId = pathname.split('/')[2];
        if (patientId) return { type: 'patient', patientId };
    }
    if (pathname.startsWith('/admission/')) {
        const admissionId = pathname.split('/')[2];
        if (admissionId) return { type: 'admission', admissionId };
    }
    if (pathname === '/templates') {
        return { type: 'utility', slug: 'templates', title: 'Mes Modèles', route: '/templates' };
    }
    return null;
}

// ============================================================
// Provider
// ============================================================

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
    const [activeTabId, setActiveTabIdState] = useState<string | null>(null);
    const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed'>('expanded');

    const location = useLocation();
    const navigate = useNavigate();

    // Refs for StrictMode double-mount safety and synchronous reads inside effects.
    const tabsRef = useRef(tabs);
    useEffect(() => { tabsRef.current = tabs; }, [tabs]);
    const activeTabIdRef = useRef(activeTabId);
    useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);

    // Legacy derivations
    const isPatientRoute = location.pathname.startsWith('/patient/');

    // ---------------------------------------
    // Core state mutations
    // ---------------------------------------

    /** Create a new tab or switch to an existing one by content-addressed id. */
    const openTab = useCallback((input: OpenTabInput) => {
        const candidate = buildTab(input);
        const currentTabs = tabsRef.current;
        const existing = currentTabs.find(t => t.id === candidate.id);

        if (existing) {
            // Already open: bump MRU, switch active, navigate.
            const now = Date.now();
            tabsRef.current = currentTabs.map(t =>
                t.id === existing.id ? { ...t, lastVisitedAt: now } : t
            );
            activeTabIdRef.current = existing.id;
            setTabs(tabsRef.current);
            setActiveTabIdState(existing.id);
            if (location.pathname !== existing.route) {
                navigate(existing.route);
            }
            return;
        }

        // Cap check
        if (currentTabs.length >= MAX_TABS) {
            toast.error(`Maximum de ${MAX_TABS} onglets ouverts atteint. Fermez-en un avant d'en ouvrir un autre.`);
            // Route back to active tab to avoid leaving the user on a dead URL
            const activeTab = currentTabs.find(t => t.id === activeTabIdRef.current);
            navigate(activeTab ? activeTab.route : '/patients', { replace: true });
            return;
        }

        // New tab
        const nextTabs = [...currentTabs, candidate];
        tabsRef.current = nextTabs;
        activeTabIdRef.current = candidate.id;
        setTabs(nextTabs);
        setActiveTabIdState(candidate.id);
        if (location.pathname !== candidate.route) {
            navigate(candidate.route);
        }
    }, [navigate, location.pathname]);

    /** Switch to an already-open tab (no-op if id unknown). */
    const setActiveTab = useCallback((id: string) => {
        const tab = tabsRef.current.find(t => t.id === id);
        if (!tab) return;
        const now = Date.now();
        tabsRef.current = tabsRef.current.map(t =>
            t.id === id ? { ...t, lastVisitedAt: now } : t
        );
        activeTabIdRef.current = id;
        setTabs(tabsRef.current);
        setActiveTabIdState(id);
        if (location.pathname !== tab.route) {
            navigate(tab.route);
        }
    }, [navigate, location.pathname]);

    /** Close a tab. If it was active, MRU-fallback to the most recently visited remaining tab. */
    const closeTab = useCallback((id: string) => {
        const currentTabs = tabsRef.current;
        const wasActive = activeTabIdRef.current === id;
        const nextTabs = currentTabs.filter(t => t.id !== id);

        tabsRef.current = nextTabs;
        setTabs(nextTabs);

        if (wasActive) {
            if (nextTabs.length > 0) {
                const mru = nextTabs.reduce((a, b) => (b.lastVisitedAt > a.lastVisitedAt ? b : a), nextTabs[0]);
                activeTabIdRef.current = mru.id;
                setActiveTabIdState(mru.id);
                navigate(mru.route);
            } else {
                activeTabIdRef.current = null;
                setActiveTabIdState(null);
                navigate('/patients');
            }
        }
    }, [navigate]);

    /** Update display metadata without changing identity / MRU. */
    const updateTabMeta = useCallback((id: string, patch: Partial<Pick<WorkspaceTab, 'title' | 'subtitle' | 'activeInnerTab'>>) => {
        setTabs(prev => prev.map(t => {
            if (t.id !== id) return t;
            const merged = { ...t, ...patch };
            // keep legacy aliases in sync
            if (patch.title !== undefined) merged.label = patch.title;
            if (patch.activeInnerTab !== undefined) merged.activeDossierTab = patch.activeInnerTab;
            return merged;
        }));
    }, []);

    const clearTabPayload = useCallback((id: string) => {
        setTabs(prev => prev.map(t => {
            if (t.id !== id || !t.initialPayload) return t;
            const { initialPayload, ...rest } = t;
            return rest as WorkspaceTab;
        }));
    }, []);

    // ---------------------------------------
    // URL → workspace sync (deep-link, refresh, browser back/forward)
    //
    // Also drives the tab strip when an admission is reached via a plain
    // navigate(), so the old collision (patient tab highlighted while an
    // unrelated admission is shown) is impossible.
    // ---------------------------------------
    useEffect(() => {
        const input = routeToOpenInput(location.pathname);
        if (!input) return;

        const candidateId =
            input.type === 'patient'   ? `patient:${input.patientId}` :
            input.type === 'admission' ? `admission:${input.admissionId}` :
                                         `utility:${input.slug}`;

        const currentTabs = tabsRef.current;
        const existing = currentTabs.find(t => t.id === candidateId);

        if (existing) {
            if (activeTabIdRef.current !== existing.id) {
                activeTabIdRef.current = existing.id;
                setActiveTabIdState(existing.id);
            }
            const now = Date.now();
            if (Math.abs(now - existing.lastVisitedAt) > 200) {
                tabsRef.current = currentTabs.map(t =>
                    t.id === existing.id ? { ...t, lastVisitedAt: now } : t
                );
                setTabs(tabsRef.current);
            }
            return;
        }

        // Tab doesn't exist yet — create one (handles direct URL entry + refresh).
        if (currentTabs.length >= MAX_TABS) {
            toast.error(`Maximum de ${MAX_TABS} onglets ouverts atteint.`);
            const activeTab = currentTabs.find(t => t.id === activeTabIdRef.current);
            navigate(activeTab ? activeTab.route : '/patients', { replace: true });
            return;
        }
        // Double-mount protection (StrictMode)
        if (currentTabs.some(t => t.id === candidateId)) return;

        const newTab = buildTab(input);
        tabsRef.current = [...currentTabs, newTab];
        activeTabIdRef.current = newTab.id;
        setTabs(tabsRef.current);
        setActiveTabIdState(newTab.id);
    }, [location.pathname, navigate]);

    // ---------------------------------------
    // Legacy API shims — delegate to the new core.
    // Kept for Layout.tsx / PatientDossier.tsx until they migrate in Phase 2.
    // ---------------------------------------
    const openWorkspace = useCallback((patientId: string) => {
        openTab({ type: 'patient', patientId });
    }, [openTab]);

    const openUtilityTab = useCallback((utilityId: string, label: string, route: string, initialPayload?: any) => {
        // Old utilityId format was "ws-utility-<slug>" — strip the prefix for the new slug.
        const slug = utilityId.startsWith('ws-utility-') ? utilityId.slice('ws-utility-'.length) : utilityId;
        openTab({ type: 'utility', slug, title: label, route, payload: initialPayload });
    }, [openTab]);

    const closeWorkspace = useCallback((workspaceId: string) => {
        closeTab(workspaceId);
    }, [closeTab]);

    const updateWorkspaceLabel = useCallback((workspaceId: string, label: string) => {
        updateTabMeta(workspaceId, { title: label });
    }, [updateTabMeta]);

    const updateActiveDossierTab = useCallback((workspaceId: string, dossierTabId: string) => {
        updateTabMeta(workspaceId, { activeInnerTab: dossierTabId });
    }, [updateTabMeta]);

    return (
        <WorkspaceContext.Provider value={{
            // new
            tabs,
            activeTabId,
            openTab,
            closeTab,
            setActiveTab,
            updateTabMeta,
            clearTabPayload,
            // legacy
            workspaceTabs: tabs,
            activeWorkspaceId: activeTabId,
            openWorkspace,
            openUtilityTab,
            closeWorkspace,
            updateWorkspaceLabel,
            updateActiveDossierTab,
            isPatientRoute,
            // sidebar
            sidebarState,
            setSidebarState,
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
