
import React, { useState } from 'react';
import { PartnerInstitution } from '../../types/pharmacy';
import { Building2, Plus, Edit2, Trash2, X, Save, Phone, Mail, MapPin } from 'lucide-react';

interface PartnerManagerProps {
  partners: PartnerInstitution[];
  onUpdatePartners: (partners: PartnerInstitution[]) => void;
}

export const PartnerManager: React.FC<PartnerManagerProps> = ({ partners, onUpdatePartners }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<PartnerInstitution>>({
    name: '',
    type: 'Hôpital',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    isActive: true
  });

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ 
      name: '', type: 'Hôpital', contactPerson: '', 
      phone: '', email: '', address: '', isActive: true 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (partner: PartnerInstitution) => {
    setEditingId(partner.id);
    setFormData({ ...partner });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) return alert('Le nom est obligatoire');

    let newPartners = [...partners];
    
    if (editingId) {
      newPartners = newPartners.map(p => 
        p.id === editingId ? { ...p, ...formData } as PartnerInstitution : p
      );
    } else {
      const newPartner: PartnerInstitution = {
        id: `PART-${Date.now()}`,
        name: formData.name || '',
        type: formData.type as any,
        contactPerson: formData.contactPerson || '',
        phone: formData.phone || '',
        email: formData.email || '',
        address: formData.address || '',
        isActive: formData.isActive || true
      };
      newPartners.push(newPartner);
    }

    onUpdatePartners(newPartners);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer ce partenaire ?')) {
      onUpdatePartners(partners.filter(p => p.id !== id));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Institutions Partenaires</h2>
          <p className="text-slate-500 text-sm">Gérez les hôpitaux et organisations pour les prêts sortants.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm"
        >
          <Plus size={18} />
          <span>Ajouter Partenaire</span>
        </button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {partners.map(partner => (
          <div key={partner.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{partner.name}</h3>
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{partner.type}</span>
                </div>
              </div>
              <div className="flex space-x-1">
                 <button onClick={() => openEditModal(partner)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button>
                 <button onClick={() => handleDelete(partner.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
              </div>
            </div>
            
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center space-x-2">
                <UserIcon size={14} className="text-slate-400" />
                <span>{partner.contactPerson}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone size={14} className="text-slate-400" />
                <span>{partner.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail size={14} className="text-slate-400" />
                <span className="truncate">{partner.email || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin size={14} className="text-slate-400" />
                <span className="truncate">{partner.address || 'N/A'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
               <h3 className="font-bold text-lg">{editingId ? 'Modifier Partenaire' : 'Nouveau Partenaire'}</h3>
               <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
               <div className="col-span-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom Institution</label>
                 <input className="w-full border rounded px-3 py-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                 <select className="w-full border rounded px-3 py-2 bg-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                    <option>Hôpital</option>
                    <option>Clinique</option>
                    <option>ONG</option>
                    <option>Gouvernement</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact</label>
                 <input className="w-full border rounded px-3 py-2" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone</label>
                 <input className="w-full border rounded px-3 py-2" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
               </div>
               <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                 <input className="w-full border rounded px-3 py-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
               </div>
               <div className="col-span-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Adresse</label>
                 <input className="w-full border rounded px-3 py-2" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
               </div>
            </div>
            <div className="p-4 bg-slate-50 text-right space-x-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium">Annuler</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded font-medium flex items-center ml-auto">
                 <Save size={18} className="mr-2" /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const UserIcon = ({size, className}: {size:number, className?:string}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
