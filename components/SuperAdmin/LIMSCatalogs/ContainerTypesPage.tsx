import React, { useState } from 'react';
import { LimsCatalogGrid } from './LimsCatalogGrid';

export const ContainerTypesPage = () => {
    return (
        <LimsCatalogGrid 
            resource="lab-container-types"
            title="Types de Conteneurs (Tubes)"
            columns={[
                { key: 'additive_type', label: 'Additif', render: v => <span className="text-slate-600 font-medium text-xs">{v || 'Sans Additif'}</span> },
                { 
                    key: 'tube_color', 
                    label: 'Couleur', 
                    render: v => v ? (
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border shadow-sm" style={{ backgroundColor: v }}></span>
                            <span className="text-xs uppercase text-slate-500">{v}</span>
                        </div>
                    ) : <span className="text-slate-400 text-xs">-</span>
                }
            ]}
            renderForm={(initialData, onSubmit, onCancel, isSaving, error) => {
                return <ContainerTypeForm initialData={initialData} onSubmit={onSubmit} onCancel={onCancel} isSaving={isSaving} error={error} />;
            }}
        />
    );
};

const ContainerTypeForm = ({ initialData, onSubmit, onCancel, isSaving, error }: any) => {
    const [code, setCode] = useState(initialData?.code || '');
    const [libelle, setLibelle] = useState(initialData?.libelle || '');
    const [additiveType, setAdditiveType] = useState(initialData?.additive_type || 'NONE');
    const [tubeColor, setTubeColor] = useState(initialData?.tube_color || '#ffffff');
    const [description, setDescription] = useState(initialData?.description || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ code, libelle, additive_type: additiveType, tube_color: tubeColor, description });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200">{error}</div>}
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                    <input required type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 uppercase font-mono text-sm" placeholder="Ex: SST" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Libellé</label>
                    <input required type="text" value={libelle} onChange={e => setLibelle(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Ex: Tube Séparateur de Sérum" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type d'Additif</label>
                    <select required value={additiveType} onChange={e => setAdditiveType(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="NONE">Sans Additif / Sec</option>
                        <option value="EDTA">EDTA (K2/K3)</option>
                        <option value="CITRATE">Citrate de Sodium</option>
                        <option value="HEPARIN">Héparine (Lithium/Sodium)</option>
                        <option value="FLUORIDE">Fluorure / Oxalate</option>
                        <option value="GEL">Gel Séparateur</option>
                        <option value="SPS">SPS (Hémoculture)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Couleur du Bouchon</label>
                    <div className="flex gap-3">
                        <input type="color" value={tubeColor} onChange={e => setTubeColor(e.target.value)} className="h-10 w-12 rounded cursor-pointer border-0 p-0" />
                        <input type="text" value={tubeColor} onChange={e => setTubeColor(e.target.value)} className="flex-1 border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 font-mono text-sm uppercase" />
                    </div>
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
