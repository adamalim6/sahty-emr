
import React, { useState } from 'react';
import { PharmacySupplier } from '../../types/pharmacy';
import { Truck, Plus, Edit2, Trash2, X, Save, Phone, Mail, MapPin, Globe, Check, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';

interface SupplierManagerProps {
  suppliers: PharmacySupplier[];
  onUpdateSuppliers: () => void;
}

export const SupplierManager: React.FC<SupplierManagerProps> = ({ suppliers, onUpdateSuppliers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<Partial<PharmacySupplier>>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    isActive: true
  });

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ 
      name: '', contactPerson: '', 
      phone: '', email: '', address: '', isActive: true 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: PharmacySupplier) => {
    if (supplier.source === 'GLOBAL') {
      alert("Impossible de modifier un fournisseur global.");
      return;
    }
    setEditingId(supplier.id);
    setFormData({ ...supplier });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) return alert('Le nom est obligatoire');

    setIsLoading(true);
    try {
      if (editingId) {
        await api.updateSupplier({ ...formData, id: editingId });
      } else {
        await api.createSupplier(formData);
      }
      await onUpdateSuppliers();
      setIsModalOpen(false);
    } catch (e: any) {
        console.error(e);
        alert(`Erreur: ${e.message || "Une erreur est survenue"}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = async (supplier: PharmacySupplier) => {
    if (supplier.source === 'GLOBAL') {
        alert("Impossible de supprimer un fournisseur global.");
        return;
    }
    if (window.confirm('Supprimer ce fournisseur ?')) {
      try {
          await api.deleteSupplier(supplier.id);
          await onUpdateSuppliers();
      } catch (e: any) {
          console.error(e);
          alert(`Erreur: ${e.message || "Une erreur est survenue"}`);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestion des Fournisseurs</h2>
          <p className="text-slate-500 text-sm">Gérez les fournisseurs locaux et consultez les fournisseurs globaux.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
        >
          <Plus size={18} />
          <span>Nouveau Fournisseur</span>
        </button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {suppliers.map(supplier => {
            const isGlobal = supplier.source === 'GLOBAL';
            return (
          <div key={supplier.id} className={`bg-white rounded-xl border shadow-sm p-5 transition-shadow relative overflow-hidden ${isGlobal ? 'border-slate-200' : 'border-blue-100 hover:shadow-md'}`}>
            {isGlobal && (
                <div className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 uppercase rounded-bl-lg flex items-center">
                    <Globe size={10} className="mr-1" /> Global
                </div>
            )}
            {!isGlobal && (
                <div className="absolute top-0 right-0 bg-green-50 text-green-600 text-[10px] font-bold px-2 py-1 uppercase rounded-bl-lg flex items-center border-b border-l border-green-100">
                    <CheckCircle2 size={10} className="mr-1" /> Local
                </div>
            )}

            <div className="flex justify-between items-start mb-4 mt-2">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${isGlobal ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{supplier.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${supplier.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {supplier.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 text-sm text-slate-600 mb-4">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-400 text-xs uppercase w-16">Contact</span>
                <span className="truncate flex-1">{supplier.contactPerson || '-'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-400 text-xs uppercase w-16">Tél</span>
                <span className="truncate flex-1">{supplier.phone || '-'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-400 text-xs uppercase w-16">Email</span>
                <span className="truncate flex-1">{supplier.email || '-'}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-1 pt-3 border-t border-slate-50">
                 {isGlobal ? (
                     <span className="text-xs text-slate-400 italic py-1.5">Lecture Seule</span>
                 ) : (
                     <>
                        <button onClick={() => openEditModal(supplier)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 size={16}/></button>
                        <button onClick={() => handleDelete(supplier)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16}/></button>
                     </>
                 )}
            </div>
          </div>
        )})}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
               <h3 className="font-bold text-lg text-slate-900">{editingId ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'}</h3>
               <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="col-span-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Société / Fournisseur <span className="text-red-500">*</span></label>
                 <input className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 outline-none transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Pharma Dist" />
               </div>
               
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Principal</label>
                 <input className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-300" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} placeholder="M. Nom Prénom" />
               </div>
               
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone</label>
                 <input className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-300" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
               </div>
               
               <div className="col-span-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                 <input className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-300" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
               </div>

               <div className="col-span-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Adresse</label>
                 <input className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-300" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
               </div>

               <div className="col-span-2 pt-2">
                 <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4" />
                    <span className="text-sm font-medium text-slate-700">Fournisseur Actif</span>
                 </label>
               </div>
            </div>

            <div className="p-4 bg-slate-50 text-right space-x-2 border-t border-slate-100">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-white rounded-lg transition-colors" disabled={isLoading}>Annuler</button>
              <button onClick={handleSave} disabled={isLoading} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors flex items-center ml-auto inline-flex">
                 {isLoading ? '...' : <><Save size={18} className="mr-2" /> Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
