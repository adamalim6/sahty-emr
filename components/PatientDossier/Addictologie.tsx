import React, { useState } from 'react';
import { 
  Cigarette, 
  Wine, 
  Plus, 
  Trash2, 
  Pencil, 
  Save, 
  X, 
  AlertTriangle, 
  Activity, 
  TrendingDown, 
  Clock,
  Zap
} from 'lucide-react';

// --- Types ---

type AddictionType = 'Tabac' | 'Alcool' | 'Cannabis' | 'Autres substances' | 'Comportementale';
type Status = 'Actif' | 'En sevrage' | 'Sevré' | 'Occasionnel';

interface AddictionRecord {
  id: string;
  type: AddictionType;
  substance: string;
  quantity: string;
  unit: string;
  frequency: string;
  status: Status;
  startDate?: string;
  stopDate?: string;
  motivation: number; // 0 to 10
  treatment?: string;
  notes?: string;
}

const MOCK_ADDICTIONS: AddictionRecord[] = [
  {
    id: '1',
    type: 'Tabac',
    substance: 'Cigarettes',
    quantity: '10',
    unit: 'cig/jour',
    frequency: 'Quotidien',
    status: 'Actif',
    startDate: '2005-09-01',
    motivation: 4,
    notes: 'A déjà essayé d\'arrêter en 2018 avec patchs.'
  },
  {
    id: '2',
    type: 'Alcool',
    substance: 'Vin / Bière',
    quantity: '3',
    unit: 'verres',
    frequency: 'Weekend',
    status: 'Occasionnel',
    motivation: 8,
    notes: 'Consommation festive uniquement.'
  }
];

const INITIAL_FORM: Partial<AddictionRecord> = {
  type: 'Tabac',
  substance: '',
  quantity: '',
  unit: '',
  frequency: 'Quotidien',
  status: 'Actif',
  motivation: 5,
  notes: ''
};

export const Addictologie: React.FC = () => {
  const [records, setRecords] = useState<AddictionRecord[]>(MOCK_ADDICTIONS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<AddictionRecord>>(INITIAL_FORM);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.substance) return;

    if (formData.id) {
      setRecords(prev => prev.map(r => r.id === formData.id ? { ...formData as AddictionRecord } : r));
    } else {
      const newRecord = { ...formData, id: Date.now().toString() } as AddictionRecord;
      setRecords([newRecord, ...records]);
    }

    setIsModalOpen(false);
    setFormData(INITIAL_FORM);
  };

  const handleEdit = (record: AddictionRecord) => {
    setFormData(record);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer cette fiche d\'addictologie ?')) {
      setRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  const getStatusColor = (status: Status) => {
    switch (status) {
      case 'Actif': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'En sevrage': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Sevré': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Cigarette className="mr-2 text-indigo-600" />
            Addictologie & Dépendances
          </h3>
          <p className="text-sm text-gray-500">Suivi des consommations de substances et addictions comportementales.</p>
        </div>
        <button 
          onClick={() => { setFormData(INITIAL_FORM); setIsModalOpen(true); }}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Ajouter un suivi</span>
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Cigarette className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucun antécédent d'addiction enregistré.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {records.map(record => (
            <div key={record.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${record.type === 'Alcool' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {record.type === 'Alcool' ? <Wine size={20} /> : <Cigarette size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{record.substance}</h4>
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">{record.type}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getStatusColor(record.status)}`}>
                    {record.status}
                  </span>
                  <div className="flex space-x-1 border-l border-gray-100 pl-2 ml-1">
                    <button onClick={() => handleEdit(record)} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil size={14}/></button>
                    <button onClick={() => handleDelete(record.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Quantité / Fréq.</span>
                  <span className="text-sm font-bold text-gray-800">{record.quantity} {record.unit} ({record.frequency})</span>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Motivation arrêt</span>
                  <div className="flex items-center space-x-1 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full ${record.motivation > 7 ? 'bg-emerald-500' : record.motivation > 4 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${record.motivation * 10}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-gray-700">{record.motivation}/10</span>
                  </div>
                </div>
              </div>

              {record.notes && (
                <div className="text-xs text-gray-600 bg-indigo-50/50 p-3 rounded-lg italic border border-indigo-100/50">
                  <span className="font-bold text-indigo-800 non-italic block mb-1">Notes cliniques :</span>
                  {record.notes}
                </div>
              )}
              
              <div className="mt-4 flex items-center text-[10px] text-gray-400">
                <Clock size={10} className="mr-1"/> Débuté le {record.startDate ? new Date(record.startDate).toLocaleDateString() : 'Inconnu'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Zap size={20} className="mr-2 text-indigo-600"/>
                {formData.id ? 'Modifier le suivi' : 'Nouveau suivi Addicto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Type d'addiction</label>
                  <select name="type" value={formData.type} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white">
                    <option value="Tabac">Tabac</option>
                    <option value="Alcool">Alcool</option>
                    <option value="Cannabis">Cannabis</option>
                    <option value="Autres substances">Autres substances</option>
                    <option value="Comportementale">Comportementale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Substance / Activité *</label>
                  <input type="text" name="substance" value={formData.substance} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" placeholder="Ex: Marlboro, Vodka, Jeu..." />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Qté</label>
                  <input type="text" name="quantity" value={formData.quantity} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" placeholder="10" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Unité</label>
                  <input type="text" name="unit" value={formData.unit} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" placeholder="cig, verres..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Fréquence</label>
                  <select name="frequency" value={formData.frequency} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white">
                    <option value="Quotidien">Quotidien</option>
                    <option value="Weekend">Weekend</option>
                    <option value="Occasionnel">Occasionnel</option>
                    <option value="Binge">Binge drinking</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Statut actuel</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white">
                    <option value="Actif">Actif</option>
                    <option value="En sevrage">En sevrage</option>
                    <option value="Sevré">Sevré</option>
                    <option value="Occasionnel">Occasionnel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Motivation arrêt (0-10)</label>
                  <input type="range" name="motivation" min="0" max="10" value={formData.motivation} onChange={handleInputChange} className="w-full accent-indigo-600 mt-2" />
                  <div className="flex justify-between text-[10px] text-gray-400 font-bold px-1"><span>0</span><span>5</span><span>10</span></div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Notes & Traitements de substitution</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" placeholder="Historique, échecs de sevrage, traitements en cours..." />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date de début (approx.)</label>
                <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">Annuler</button>
              <button onClick={handleSave} disabled={!formData.substance} className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50">
                <Save size={18} className="mr-2"/> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};