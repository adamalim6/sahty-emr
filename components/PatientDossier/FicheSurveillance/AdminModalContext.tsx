import React, { createContext, useContext, useState } from "react";

export type AdminModalPayload = {
    prescriptionId: string;
    eventId?: string;
    prescriptionName: string;
    slotTime: string;
    duration: number;
    requiresEndEvent: boolean;
    activePerfusionEvent: any | null;
    historyEvents: any[];
    requiresFluidInfo: boolean;
    isTransfusion: boolean;
    isBiology?: boolean; // New!
};

type AdminModalState = {
  isOpen: boolean;
  payload: AdminModalPayload | null;
};

type AdminModalDispatchType = {
  openAdminModal: (payload: AdminModalPayload) => void;
  closeAdminModal: () => void;
};

const AdminModalStateContext = createContext<AdminModalState | null>(null);
const AdminModalDispatchContext = createContext<AdminModalDispatchType | null>(null);

export const AdminModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [adminModal, setAdminModal] = useState<AdminModalState>({
    isOpen: false,
    payload: null,
  });

  const dispatch = React.useMemo(() => ({
    openAdminModal: (payload: AdminModalPayload) => {
      setAdminModal({ isOpen: true, payload });
    },
    closeAdminModal: () => {
      setAdminModal({ isOpen: false, payload: null });
    }
  }), []);

  return (
    <AdminModalDispatchContext.Provider value={dispatch}>
      <AdminModalStateContext.Provider value={adminModal}>
        {children}
      </AdminModalStateContext.Provider>
    </AdminModalDispatchContext.Provider>
  );
};

export const useAdminModalState = () => {
  const context = useContext(AdminModalStateContext);
  if (!context) throw new Error("useAdminModalState must be used inside AdminModalProvider");
  return context;
};

export const useAdminModalDispatch = () => {
  const context = useContext(AdminModalDispatchContext);
  if (!context) throw new Error("useAdminModalDispatch must be used inside AdminModalProvider");
  return context;
};
