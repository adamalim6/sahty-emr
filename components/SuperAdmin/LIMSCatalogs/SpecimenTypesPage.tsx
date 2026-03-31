import React, { useState } from 'react';
import { LimsCatalogGrid } from './LimsCatalogGrid';

export const SpecimenTypesPage = () => {
    return (
        <LimsCatalogGrid 
            resource="lab-specimen-types"
            title="Types d'Échantillons (Prélèvements)"
            columns={[
                { key: 'base_specimen', label: 'Spécimen de Base', render: v => <span className="font-medium text-slate-700 text-xs">{v}</span> },
                { key: 'matrix_type', label: 'Type Matrice', render: v => <span className="text-slate-500 text-xs bg-slate-100 px-2 py-0.5 rounded-full">{v || '-'}</span> }
            ]}
            renderForm={(initialData, onSubmit, onCancel, isSaving, error) => {
                return <SpecimenTypeForm initialData={initialData} onSubmit={onSubmit} onCancel={onCancel} isSaving={isSaving} error={error} />;
            }}
        />
    );
};

const SpecimenTypeForm = ({ initialData, onSubmit, onCancel, isSaving, error }: any) => {
    const [code, setCode] = useState(initialData?.code || '');
    const [libelle, setLibelle] = useState(initialData?.libelle || '');
    const [baseSpecimen, setBaseSpecimen] = useState(initialData?.base_specimen || 'BLOOD');
    const [matrixType, setMatrixType] = useState(initialData?.matrix_type || 'SERUM');
    const [description, setDescription] = useState(initialData?.description || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ code, libelle, base_specimen: baseSpecimen, matrix_type: matrixType, description });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200">{error}</div>}
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                    <input required type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 uppercase font-mono text-sm" placeholder="Ex: SERUM" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Libellé</label>
                    <input required type="text" value={libelle} onChange={e => setLibelle(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Ex: Sérum Sanguin" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Spécimen de Base</label>
                    <select required value={baseSpecimen} onChange={e => setBaseSpecimen(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="BLOOD">Sang (BLOOD)</option>
                        <option value="URINE">Urine (URINE)</option>
                        <option value="SWAB">Écouvillon (SWAB)</option>
                        <option value="FLUID">Liquide (FLUID)</option>
                        <option value="STOOL">Selles (STOOL)</option>
                        <option value="TISSUE">Tissu (TISSUE)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type Matrice</label>
                    <select required value={matrixType} onChange={e => setMatrixType(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="SERUM">Sérum</option>
                        <option value="PLASMA">Plasma</option>
                        <option value="WHOLE_BLOOD">Sang Total</option>
                        <option value="ISOLATE">Isolat</option>
                        <option value="SLIDE">Lame</option>
                        <option value="NONE">Aucune / Native</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button type="button" onClick={onCancel} className="px-4 py-2 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Annuler</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
            </div>
        </form>
    );
};
