import React, { useState, useEffect } from 'react';
import { RotateCcw, Package, AlertCircle } from 'lucide-react';

interface RetoursPageProps {
  serviceId?: string;
  serviceName?: string;
}

/**
 * Retours Page - Department Stock Returns to Central Pharmacy
 * 
 * This page handles the return workflow:
 * 1. Nurse declares products to return (creates stock_returns + lines)
 * 2. Pharmacist receives the returned products (creates return_receptions)
 * 3. Pharmacist decides outcome (creates return_decisions: REINTEGRATE/CHARITY/WASTE/DESTRUCTION)
 */
export const RetoursPage: React.FC<RetoursPageProps> = ({ serviceId, serviceName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Fetch existing returns for this service
    setLoading(false);
  }, [serviceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <RotateCcw className="w-7 h-7 text-indigo-600" />
            Retours
          </h1>
          <p className="text-slate-600 mt-1">
            Gérez les retours de stock vers la pharmacie centrale
            {serviceName && <span className="font-medium text-indigo-600"> • {serviceName}</span>}
          </p>
        </div>
        
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
          <Package className="w-4 h-4" />
          Nouveau Retour
        </button>
      </div>

      {/* Placeholder for UI - User will provide design */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center text-slate-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="text-lg font-medium">Interface en cours de développement</p>
          <p className="text-sm mt-2">L'interface utilisateur sera implémentée selon vos spécifications</p>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
        <h3 className="font-semibold text-indigo-900 mb-2">Processus de retour</h3>
        <ol className="list-decimal list-inside text-sm text-indigo-700 space-y-1">
          <li><strong>Déclaration</strong> - Le service déclare les produits à retourner</li>
          <li><strong>Réception</strong> - La pharmacie reçoit physiquement les produits</li>
          <li><strong>Décision</strong> - Le pharmacien décide du devenir (réintégration, charité, déchet, destruction)</li>
        </ol>
      </div>
    </div>
  );
};

export default RetoursPage;
