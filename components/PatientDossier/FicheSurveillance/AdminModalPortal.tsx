import React from "react";
import { createPortal } from "react-dom";
import { useAdminModalState, useAdminModalDispatch } from "./AdminModalContext";
import { AdministrationModal, AdministrationSavePayload } from "../AdministrationModal";

interface AdminModalPortalProps {
    onSave: (prescriptionId: string, eventId: string, slotTime: string, payload: AdministrationSavePayload | AdministrationSavePayload[]) => Promise<void>;
    onCancelEvent: (prescriptionId: string, eventId: string, adminEventId: string, reason?: string) => Promise<void>;
    onSkipEvent: (prescriptionId: string, eventId: string) => Promise<void>;
    availableBags: any[];
}

export const AdminModalPortal: React.FC<AdminModalPortalProps> = ({
    onSave,
    onCancelEvent,
    onSkipEvent,
    availableBags
}) => {
  const adminModal = useAdminModalState();
  const { closeAdminModal } = useAdminModalDispatch();

  if (!adminModal.isOpen || !adminModal.payload) return null;

  return createPortal(
    <AdministrationModal
        isOpen={adminModal.isOpen}
        onClose={closeAdminModal}
        onSave={async (payload) => {
            await onSave(adminModal.payload!.prescriptionId, adminModal.payload!.eventId!, adminModal.payload!.slotTime, payload);
            closeAdminModal();
        }}
        onCancelEvent={async (adminEventId, reason) => {
            await onCancelEvent(adminModal.payload!.prescriptionId, adminModal.payload!.eventId!, adminEventId, reason);
            closeAdminModal();
        }}
        onSkipEvent={async (eventId) => {
            await onSkipEvent(adminModal.payload!.prescriptionId, eventId);
            closeAdminModal();
        }}
        availableBags={availableBags}
        prescriptionName={adminModal.payload.prescriptionName}
        slotTime={adminModal.payload.slotTime}
        duration={adminModal.payload.duration}
        requiresEndEvent={adminModal.payload.requiresEndEvent}
        requiresFluidInfo={adminModal.payload.requiresFluidInfo}
        activePerfusionEvent={adminModal.payload.activePerfusionEvent}
        historyEvents={adminModal.payload.historyEvents}
        isTransfusion={adminModal.payload.isTransfusion}
        isBiology={adminModal.payload.isBiology}
        eventId={adminModal.payload.eventId}
    />,
    document.body
  );
};
