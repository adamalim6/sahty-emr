import React, { useState } from 'react';
import { LimsCatalogGrid } from './LimsCatalogGrid';

export const LabSectionsPage = () => {
    return (
        <LimsCatalogGrid 
            resource="lab-sections"
            title="Sections Laboratoire"
            columns={[]}
            renderForm={(initialData, onSubmit, onCancel, isSaving, error) => {
                return <LabSectionForm initialData={initialData} onSubmit={onSubmit} onCancel={onCancel} isSaving={isSaving} error={error} />;
            }}
        />
    );
};

const LabSectionForm = ({ initialData, onSubmit, onCancel, isSaving, error }: any) => {
    const [code, setCode] = useState(initialData?.code || '');
    const [libelle, setLibelle] = useState(initialData?.libelle || '');
    const [description, setDescription] = useState(initialData?.description || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ code, libelle, description });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200">{error}</div>}
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code Section</label>
                <input required type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 uppercase font-mono text-sm" placeholder="Ex: BIOCH" />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Libellé</label>
                <input required type="text" value={libelle} onChange={e => setLibelle(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Ex: Biochimie Clinique" />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button type="button" onClick={onCancel} className="px-4 py-2 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Annuler</button>
                <button type="submit" disabled={isSaving || !code || !libelle} className="px-4 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
            </div>
        </form>
    );
};
