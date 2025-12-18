
import React, { useState } from 'react';
import { StockLocation, InventoryItem } from '../../types/pharmacy';
import { MapPin, Plus, Edit2, Trash2, X, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LocationManagerProps {
  locations: StockLocation[];
  inventoryItems: InventoryItem[];
  onUpdateLocations: (locations: StockLocation[]) => void;
}

export const LocationManager: React.FC<LocationManagerProps> = ({ locations, inventoryItems, onUpdateLocations }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<StockLocation>>({
    name: '',
    description: '',
    isActive: true
  });
  const [error, setError] = useState('');

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', isActive: true });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (loc: StockLocation) => {
    setEditingId(loc.id);
    setFormData({ ...loc });
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name?.trim()) {
      setError('Le nom de l\'emplacement est requis.');
      return;
    }

    const nameExists = locations.some(l => 
      l.name.toLowerCase() === formData.name?.toLowerCase() && l.id !== editingId
    );

    if (nameExists) {
      setError('Un emplacement avec ce nom existe déjà.');
      return;
    }

    let newLocations = [...locations];

    if (editingId) {
      newLocations = newLocations.map(l => 
        l.id === editingId ? { ...l, ...formData } as StockLocation : l
      );
    } else {
      const newLoc: StockLocation = {
        id: `LOC-${Date.now()}`,
        name: formData.name,
        description: formData.description || '',
        isActive: formData.isActive || true
      };
      newLocations.push(newLoc);
    }

    onUpdateLocations(newLocations);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const locName = locations.find(l => l.id === id)?.name;
    
    const isUsed = inventoryItems.some(item => item.location === locName);

    if (isUsed) {
      alert(`Impossible de supprimer "${locName}" car des produits y sont stockés.`);
      return;
    }

    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet emplacement ?')) {
      const newLocations = locations.filter(l => l.id !== id);
      onUpdateLocations(newLocations);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Emplacements de Stockage</h2>
          <p className="text-slate-500 text-sm">Configurez les zones, étagères et réfrigérateurs.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
        >
          <Plus size={18} />
          <span>Nouvel Emplacement</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Nom</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4 text-center">Articles Assignés</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {locations.map(loc => {
              const itemCount = inventoryItems.filter(i => i.location === loc.name).length;
              
              return (
                <tr key={loc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                      ${loc.isActive 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {loc.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900 flex items-center">
                    <MapPin size={16} className="mr-2 text-slate-400" />
                    {loc.name}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {loc.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${itemCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                      {itemCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => openEditModal(loc)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Modifier"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(loc.id)}
                        className={`p-1.5 rounded transition-colors ${itemCount > 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                        title={itemCount > 0 ? "Impossible de supprimer (Articles assignés)" : "Supprimer"}
                        disabled={itemCount > 0}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">{editingId ? 'Modifier Emplacement' : 'Nouvel Emplacement'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start">
                  <AlertCircle size={16} className="mt-0.5 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  placeholder="ex: Frigo 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 h-24 resize-none"
                  placeholder="Détails optionnels..."
                />
              </div>

              <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                  Emplacement Actif
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={handleSave} 
                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold shadow-sm transition-colors flex items-center space-x-2"
              >
                <Save size={18} />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
