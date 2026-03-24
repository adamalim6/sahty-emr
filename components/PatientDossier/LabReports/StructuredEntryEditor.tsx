import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { CheckCircle2, ChevronDown, ChevronRight, Plus, Search, Trash2 } from 'lucide-react';

interface StructuredEntryEditorProps {
  reportId: string;
  onComplete: () => void;
}

export const StructuredEntryEditor: React.FC<StructuredEntryEditorProps> = ({ reportId, onComplete }) => {
  const [tests, setTests] = useState<any[]>([]);
  const [actSearchQuery, setActSearchQuery] = useState('');
  const [actResults, setActResults] = useState<any[]>([]);
  const [isSearchingActs, setIsSearchingActs] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing structure
  useEffect(() => {
    loadStructure();
  }, [reportId]);

  const loadStructure = async () => {
    try {
      setIsLoading(true);
      const reportDetails = await api.getPatientLabReportDetails(reportId);
      setTests(reportDetails.tests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const searchActs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setActSearchQuery(q);
    if (q.length < 2) {
      setActResults([]);
      return;
    }
    try {
      setIsSearchingActs(true);
      const res = await api.getActes({ search: q, limit: 10 });
      setActResults(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingActs(false);
    }
  };

  const handleSelectAct = async (act: any) => {
    try {
      // 1. Fetch Analyte Contexts mapped to this act
      const analyteContexts = await api.getLabAnalyteContextsByActs([act.id]);
      
      // 2. Create the Test Group in the DB
      const test = await api.addLabReportTest(reportId, {
        global_act_id: act.id,
        custom_test_name: null
      });

      // 3. Create the empty results for each context
      const newResults = [];
      for (const ctx of analyteContexts) {
        const resultPayload = {
          analyte_context_id: ctx.id,
          raw_analyte_label: ctx.analyte_label,
          raw_unit_label: ctx.unit_label,
          raw_method_label: ctx.method_label,
          value_type: 'NUMERIC' // or fetch from somewhere/default
        };
        const newRes = await api.addLabReportResult(test.id, resultPayload);
        newResults.push(newRes);
      }

      // 4. Reload local state
      await loadStructure();
      setActSearchQuery('');
      setActResults([]);
      
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout de l'acte.");
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-[60px] flex overflow-hidden">
      {/* LEFT PANEL: Act Picker */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
           <h3 className="font-bold text-gray-800 text-sm mb-3">Ajouter une analyse</h3>
           <div className="relative">
             <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
             <input 
               type="text"
               value={actSearchQuery}
               onChange={searchActs}
               placeholder="Rechercher un acte (K+...)"
               className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
             />
             {isSearchingActs && <div className="absolute right-3 top-2.5 animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>}
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
           {actResults.map(act => (
             <div 
               key={act.id} 
               onClick={() => handleSelectAct(act)}
               className="p-3 mb-1 text-sm border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors group flex justify-between items-center"
             >
               <div>
                 <p className="font-bold text-gray-800 truncate" title={act.name}>{act.name}</p>
                 <p className="text-[10px] text-gray-500">{act.code || 'Sans code'}</p>
               </div>
               <Plus size={16} className="text-gray-400 group-hover:text-indigo-600" />
             </div>
           ))}
           {actSearchQuery.length >= 2 && actResults.length === 0 && !isSearchingActs && (
             <p className="text-center text-sm text-gray-500 mt-10">Aucun acte trouvé.</p>
           )}
        </div>
      </div>

      {/* RIGHT PANEL: Results Grid */}
      <div className="flex-1 bg-gray-50 flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : tests.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 mx-10">
              <p className="text-gray-500 font-medium">Le bilan est vide.</p>
              <p className="text-sm text-gray-400 mt-2">Recherchez et ajoutez un acte depuis le panneau de gauche pour commencer la structuration.</p>
            </div>
          ) : (
            tests.map(test => (
              <div key={test.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-indigo-50/50 border-b border-gray-200 flex justify-between items-center">
                   <h4 className="font-bold text-indigo-900 text-sm">
                     {test.global_act_name || test.custom_test_name || 'Test sans nom'}
                   </h4>
                   <button className="text-gray-400 hover:text-red-500 transition-colors">
                     <Trash2 size={16} />
                   </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-500 text-xs font-bold border-b border-gray-200">
                        <th className="px-4 py-3 font-medium">Analyte</th>
                        <th className="px-4 py-3 font-medium w-32">Valeur</th>
                        <th className="px-4 py-3 font-medium w-24">Unité</th>
                        <th className="px-4 py-3 font-medium w-48">Normes / Ref.</th>
                        <th className="px-4 py-3 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {test.results?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-center text-gray-400 text-xs italic">
                            Aucun analyte configuré pour ce test.
                          </td>
                        </tr>
                      ) : (
                        test.results?.map((res: any) => (
                          <tr key={res.id} className="border-b border-gray-100 hover:bg-gray-50/30">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {res.raw_analyte_label || res.analyte_name || 'Inconnu'}
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type={res.value_type === 'NUMERIC' ? 'number' : 'text'}
                                className="w-full border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Valeur"
                                defaultValue={res.numeric_value ?? res.text_value ?? ''}
                              />
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {res.raw_unit_label || res.unit_name || ''}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {/* TODO: Load rules from context */}
                              <span className="text-gray-400 italic">Non définie</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button className="text-gray-400 hover:text-red-500" title="Retirer">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 bg-white border-t border-gray-200 flex justify-between items-center shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
           <div className="flex items-center text-emerald-600 text-sm font-bold bg-emerald-50 px-3 py-1.5 rounded-lg">
             <CheckCircle2 size={16} className="mr-2" />
             Sauvegarde auto.{' '}
             <span className="text-gray-400 text-xs ml-2 font-normal">(Chaque champ est sauvegardé)</span>
           </div>
           <button 
             onClick={onComplete}
             className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
           >
             Terminer la saisie
           </button>
        </div>
      </div>
    </div>
  );
};
