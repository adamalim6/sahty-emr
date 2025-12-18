import React, { useState } from 'react';
import { INITIAL_SETTINGS } from '../constants';
import { Save, Shield, User, CreditCard, Clock } from 'lucide-react';

export const Settings: React.FC = () => {
  const [formData, setFormData] = useState(INITIAL_SETTINGS);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggle = () => {
    setFormData(prev => ({ ...prev, shareDataWithSahty: !prev.shareDataWithSahty }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Paramètres enregistrés avec succès !");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Paramètres du Compte</h2>
        <p className="text-gray-500">Gérez vos informations personnelles et préférences.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Identité */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center space-x-2">
            <User className="text-gray-400" size={20} />
            <h3 className="font-semibold text-gray-800">Identité & Professionnel</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Numéro de CIN</label>
              <input type="text" name="cin" value={formData.cin} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Passeport (si étranger)</label>
              <input type="text" name="passport" value={formData.passport || ''} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Numéro INPE</label>
              <input type="text" name="inpe" value={formData.inpe} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Spécialité</label>
              <select name="specialty" value={formData.specialty} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border bg-white">
                <option>Cardiologue</option>
                <option>Neurologue</option>
                <option>Généraliste</option>
                <option>Pédiatre</option>
                <option>Dermatologue</option>
              </select>
            </div>
          </div>
        </div>

        {/* Coordonnées & Horaires */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center space-x-2">
            <Clock className="text-gray-400" size={20} />
            <h3 className="font-semibold text-gray-800">Coordonnées & Disponibilité</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
              <label className="block text-sm font-medium text-gray-700">Disponibilité</label>
              <input type="text" name="availability" value={formData.availability} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Téléphone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
              <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border" />
            </div>
          </div>
        </div>

        {/* Bancaire */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center space-x-2">
            <CreditCard className="text-gray-400" size={20} />
            <h3 className="font-semibold text-gray-800">Informations Bancaires</h3>
          </div>
          <div className="p-6 space-y-4">
             <div>
              <label className="block text-sm font-medium text-gray-700">RIB</label>
              <input type="text" name="rib" value={formData.rib} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border font-mono" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">IBAN</label>
                <input type="text" name="iban" value={formData.iban} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">N° de Compte</label>
                <input type="text" name="bankAccount" value={formData.bankAccount} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 p-2 border font-mono" />
              </div>
            </div>
          </div>
        </div>

        {/* Confidentialité */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center space-x-2">
            <Shield className="text-gray-400" size={20} />
            <h3 className="font-semibold text-gray-800">Confidentialité & IA</h3>
          </div>
          <div className="p-6">
             <div className="flex items-center justify-between">
               <div className="pr-4">
                 <p className="text-sm font-medium text-gray-900">Partage de données anonymisées avec Groupe Sahty</p>
                 <p className="text-sm text-gray-500 mt-1">
                   En activant cette option, vous acceptez de partager des données cliniques strictement anonymisées pour l'entraînement de nos modèles d'Intelligence Artificielle afin d'améliorer la précision des diagnostics.
                 </p>
               </div>
               <button
                  type="button"
                  onClick={handleToggle}
                  className={`${formData.shareDataWithSahty ? 'bg-emerald-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                >
                  <span className={`${formData.shareDataWithSahty ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
               </button>
             </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" className="flex items-center space-x-2 bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-lg font-medium shadow-lg transition-transform transform active:scale-95">
            <Save size={20} />
            <span>Enregistrer les modifications</span>
          </button>
        </div>
      </form>
    </div>
  );
};
