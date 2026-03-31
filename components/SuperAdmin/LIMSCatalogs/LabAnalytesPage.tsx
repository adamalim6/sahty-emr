import React, { useState, useEffect } from 'react';
import { LimsCatalogGrid } from './LimsCatalogGrid';

export const LabAnalytesPage = () => {
    return (
        <LimsCatalogGrid 
            resource="lab-analytes"
            title="Analyses Laboratoire (Analytes)"
            labelField="libelle"
            columns={[
                { key: 'value_type', label: 'Type Valeur', render: v => <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">{v || '-'}</span> },
                { key: 'is_calculated', label: 'Calculé', render: v => (v ? <span className="text-emerald-600 font-medium text-xs">Oui</span> : <span className="text-slate-400 text-xs">Non</span>) }
            ]}
            renderForm={(initialData, onSubmit, onCancel, isSaving, error) => {
                return <LabAnalyteForm initialData={initialData} onSubmit={onSubmit} onCancel={onCancel} isSaving={isSaving} error={error} />;
            }}
        />
    );
};

const LabAnalyteForm = ({ initialData, onSubmit, onCancel, isSaving, error }: any) => {
    const [code, setCode] = useState(initialData?.code || '');
    const [libelle, setLibelle] = useState(initialData?.libelle || '');
    const [valueType, setValueType] = useState(initialData?.value_type || 'NUMERIC');
    const [isCalculated, setIsCalculated] = useState(initialData?.is_calculated || false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ code, libelle, value_type: valueType, is_calculated: isCalculated });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200">{error}</div>}
            
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                <input required type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 uppercase font-mono text-sm" placeholder="Ex: HB" />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Libellé (Label)</label>
                <input required type="text" value={libelle} onChange={e => setLibelle(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Ex: Hémoglobine" />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type de Valeur</label>
                <select required value={valueType} onChange={e => setValueType(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="NUMERIC">Numérique (NUMERIC)</option>
                    <option value="TEXT">Texte (TEXT)</option>
                    <option value="LIST">Liste (LIST)</option>
                    <option value="BOOLEAN">Booléen (BOOLEAN)</option>
                </select>
            </div>

            <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="isCalculated" checked={isCalculated} onChange={e => setIsCalculated(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <label htmlFor="isCalculated" className="text-sm text-slate-700 font-medium">Analyse calculée (Formule)</label>
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
