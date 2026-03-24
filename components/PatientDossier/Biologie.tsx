import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { BiologyList } from './LabReports/BiologyList';
import { AddBiologyReportModal } from './LabReports/AddBiologyReportModal';
import { BiologyWorkspace } from './LabReports/BiologyWorkspace';

interface BiologieProps {
  tenantPatientId: string;
}

export const Biologie: React.FC<BiologieProps> = ({ tenantPatientId }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewedReportId, setViewedReportId] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const data = await api.getPatientLabReports(tenantPatientId);
      setReports(data || []);
    } catch (e) {
      console.error('Failed to fetch biology reports', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (tenantPatientId) {
      fetchReports();
    }
  }, [tenantPatientId]);

  if (viewedReportId) {
    return (
      <BiologyWorkspace 
        reportId={viewedReportId}
        patientId={tenantPatientId}
        onClose={() => {
          setViewedReportId(null);
          fetchReports();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <BiologyList 
        reports={reports} 
        isLoading={isLoading} 
        onAddClick={() => setIsAddModalOpen(true)}
        onViewReport={setViewedReportId}
        onRefresh={fetchReports}
      />

      {isAddModalOpen && (
        <AddBiologyReportModal 
          patientId={tenantPatientId}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={(id) => {
            setIsAddModalOpen(false);
            fetchReports();
            setViewedReportId(id);
          }}
        />
      )}
    </div>
  );
};