import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Bed, Clock, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  'En cours': { label: 'En cours', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  'Sorti': { label: 'Sorti', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  'Annulé': { label: 'Annulé', color: 'bg-red-50 text-red-600 border-red-200', icon: XCircle },
};

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '-';

const getDuration = (start: string, end?: string | null) => {
  const from = new Date(start);
  const to = end ? new Date(end) : new Date();
  const days = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return '1 jour';
  return `${days} jours`;
};

export const Admissions: React.FC<{ patientId: string; patientName?: string }> = ({ patientId, patientName }) => {
  const { openTab } = useWorkspace();
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getPatientAdmissions(patientId);
        setAdmissions(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [patientId]);

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Chargement...</div>;

  if (admissions.length === 0) {
    return (
      <div className="text-center py-16">
        <Bed size={36} className="mx-auto mb-3 text-slate-300" />
        <h3 className="text-sm font-semibold text-slate-500">Aucune admission</h3>
        <p className="text-xs text-slate-400 mt-1">Ce patient n'a pas encore été admis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Admissions ({admissions.length})</h3>
      </div>

      {admissions.map((adm: any) => {
        const st = STATUS_CONFIG[adm.status] || STATUS_CONFIG['En cours'];
        const StIcon = st.icon;
        return (
          <div
            key={adm.id}
            onClick={() => openTab({
              type: 'admission',
              admissionId: adm.id,
              title: adm.admissionNumber || adm.nda || 'Admission',
              subtitle: patientName,
            })}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  <Bed size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{adm.admissionNumber || adm.nda || 'N/A'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${st.color}`}>
                      <StIcon size={10} />{st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{fmtDate(adm.admissionDate)}</span>
                    {adm.dischargeDate && <span>→ {fmtDate(adm.dischargeDate)}</span>}
                    <span className="text-slate-400">({getDuration(adm.admissionDate, adm.dischargeDate)})</span>
                    {adm.reason && <span className="text-slate-400">— {adm.reason}</span>}
                  </div>
                </div>
              </div>
              <ExternalLink size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
