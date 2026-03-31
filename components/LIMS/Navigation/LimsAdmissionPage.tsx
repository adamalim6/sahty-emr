import React from 'react';
import { AdmissionDossier } from '../../AdmissionDossier/AdmissionDossier';

export const LimsAdmissionPage: React.FC = () => {
    return (
        <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden p-6 animate-in fade-in">
            <AdmissionDossier mode="lims" />
        </div>
    );
};
