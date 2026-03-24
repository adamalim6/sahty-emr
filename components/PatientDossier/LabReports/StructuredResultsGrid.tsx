import React, { useState, useEffect, useRef } from 'react';
import { Target, Search, Plus, Trash2, Cpu, FileText, Activity, ChevronDown, ChevronRight, X, Check, Edit2, AlertTriangle, AlertCircle } from 'lucide-react';
import { api, API_BASE_URL } from '../../../services/api';
import toast from 'react-hot-toast';

interface StructuredResultsGridProps {
  reportId: string;
  patientId: string;
}

interface AnalyteRow {
  id?: string; // DB result ID
  lab_analyte_context_id: string | null;
  analyte_label: string;
  method_label: string;
  specimen_label: string;
  unit_label: string;
  value: string;
  value_type: 'NUMERIC' | 'TEXT' | 'BOOLEAN' | 'CHOICE';
  interpretation?: string | null;
  abnormal_flag_text?: string | null;
  reference_range_text?: string | null;
  status?: string;
  isMoved?: boolean;
  isDirty?: boolean;
  isCorrecting?: boolean; // UI exclusively
}

interface TestGroup {
  groupId: string; // global_act_id or 'STANDALONE'
  testId?: string; // report_test_id from DB
  type: 'TEST' | 'STANDALONE';
  label: string;
  analytes: AnalyteRow[];
  expanded?: boolean;
}

export const StructuredResultsGrid: React.FC<StructuredResultsGridProps> = ({ reportId, patientId }) => {
  const [reportStatus, setReportStatus] = useState<'DRAFT' | 'VALIDATED' | 'AMENDED' | 'ACTIVE'>('DRAFT');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [groups, setGroups] = useState<TestGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSaving, setIsSaving] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const groupsRef = useRef<TestGroup[]>(groups);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // UNMOUNT FLUSH: If the user switches tabs, the component unmounts. Flush pending saves immediately!
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      const dirtyRows: any[] = [];
      groupsRef.current.forEach(g => {
        g.analytes.forEach(a => {
          if (a.isDirty) {
            let numValue = null;
            let textValue = null;
            if (a.value_type === 'NUMERIC') {
               const parsed = Number(a.value.replace(',', '.').trim());
               if (!isNaN(parsed)) numValue = parsed;
            } else {
               textValue = a.value;
            }
            dirtyRows.push({
              id: a.id,
              patient_lab_report_test_id: g.testId,
              lab_analyte_context_id: a.lab_analyte_context_id,
              raw_analyte_label: a.analyte_label,
              value_type: a.value_type,
              numeric_value: numValue,
              text_value: textValue,
              raw_unit_text: a.unit_label
            });
          }
        });
      });

      if (dirtyRows.length > 0 && reportStatus === 'DRAFT') {
         // Fire and forget fetch during React unmount
         fetch(`${API_BASE_URL}/patient-lab-reports/${reportId}/results/autosave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify(dirtyRows),
            keepalive: true // Crucial for requests firing on unmount
         }).catch(e => console.error("Unmount flush failed", e));
      }
    };
  }, []);

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const fetchReport = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/patient-lab-reports/${reportId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error("Failed to fetch report");
      const report = await res.json();
      setReportStatus(report.status);

      if (report.tests && report.tests.length > 0) {
        // Collect global_act_ids to fetch reference contexts for empty rows
        const actIds = report.tests.map((t: any) => t.global_act_id).filter(Boolean);
        const contextsByAct: Record<string, any[]> = {};
        
        if (actIds.length > 0) {
           await Promise.all(actIds.map(async (actId: string) => {
              const ctxRes = await fetch(`${API_BASE_URL}/reference/lab-analyte-contexts/by-acts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ globalActIds: [actId] })
              });
              if (ctxRes.ok) {
                contextsByAct[actId] = await ctxRes.json();
              }
           }));
        }

        const loadedGroups: TestGroup[] = report.tests.map((t: any) => {
          const isStandalone = !t.global_act_id;
          let finalAnalytes: AnalyteRow[] = [];

          if (isStandalone) {
             finalAnalytes = (t.results || []).filter((r: any) => r.status === 'ACTIVE').map((r: any) => ({
                id: r.id,
                lab_analyte_context_id: r.lab_analyte_context_id,
                analyte_label: r.raw_analyte_label,
                method_label: r.method_id || '',
                specimen_label: r.specimen_type_id || '',
                unit_label: r.raw_unit_text || '',
                value: r.value_type === 'NUMERIC' ? (r.numeric_value != null ? Number(r.numeric_value).toString() : '') : (r.text_value || ''),
                value_type: r.value_type,
                interpretation: r.interpretation,
                abnormal_flag_text: r.abnormal_flag || r.raw_abnormal_flag_text,
                reference_range_text: r.reference_range_text,
                status: r.status,
                isDirty: false
             }));
          } else {
             // For tests, cross-reference the expected context analytes with what's actually saved
             const expectedAnalytes = contextsByAct[t.global_act_id] || [];
             
             finalAnalytes = expectedAnalytes.map(ctx => {
                const savedResult = (t.results || []).find((r: any) => r.lab_analyte_context_id === ctx.id && r.status === 'ACTIVE');
                
                if (savedResult) {
                   return {
                      id: savedResult.id,
                      lab_analyte_context_id: savedResult.lab_analyte_context_id,
                      analyte_label: savedResult.raw_analyte_label,
                      method_label: savedResult.method_id || ctx.method_label || '',
                      specimen_label: savedResult.specimen_type_id || ctx.specimen_label || '',
                      unit_label: savedResult.raw_unit_text || ctx.unit_label || '',
                      value: savedResult.value_type === 'NUMERIC' ? (savedResult.numeric_value != null ? Number(savedResult.numeric_value).toString() : '') : (savedResult.text_value || ''),
                      value_type: savedResult.value_type,
                      interpretation: savedResult.interpretation,
                      abnormal_flag_text: savedResult.abnormal_flag || savedResult.raw_abnormal_flag_text,
                      reference_range_text: savedResult.reference_range_text,
                      status: savedResult.status,
                      isDirty: false
                   };
                } else {
                   // Inject empty placeholder from reference dictionary 
                   return {
                      lab_analyte_context_id: ctx.id,
                      analyte_label: ctx.analyte_label,
                      method_label: ctx.method_label,
                      specimen_label: ctx.specimen_label,
                      unit_label: ctx.unit_label,
                      value_type: 'NUMERIC',
                      value: '',
                      isDirty: false
                   };
                }
             });
          }

          return {
            groupId: t.global_act_id || 'STANDALONE',
            testId: t.id,
            type: isStandalone ? 'STANDALONE' : 'TEST',
            label: t.raw_test_label || 'Paramètres isolés',
            expanded: true,
            analytes: finalAnalytes
          };
        });
        setGroups(loadedGroups);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        try {
          const results = await api.searchLabReference(searchQuery.trim());
          setSearchResults(results || []);
          setActiveIndex(-1);
          setShowDropdown(true);
        } catch (e) {
          console.error('Error searching lab ref', e);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const triggerAutosave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (reportStatus !== 'DRAFT') return;

    saveTimeoutRef.current = setTimeout(async () => {
      // Collect dirty rows from the latest Ref, protecting against stale closures
      const dirtyRows: any[] = [];
      groupsRef.current.forEach(g => {
        g.analytes.forEach(a => {
          if (a.isDirty) {
            let numValue = null;
            let textValue = null;
            if (a.value_type === 'NUMERIC') {
               const parsed = Number(a.value.replace(',', '.').trim());
               if (!isNaN(parsed)) numValue = parsed;
            } else {
               textValue = a.value;
            }

            dirtyRows.push({
              id: a.id,
              patient_lab_report_test_id: g.testId,
              lab_analyte_context_id: a.lab_analyte_context_id,
              raw_analyte_label: a.analyte_label,
              value_type: a.value_type,
              numeric_value: numValue,
              text_value: textValue,
              raw_unit_text: a.unit_label
            });
          }
        });
      });

      console.log("AUTOSAVE TRIGGERED", dirtyRows);

      if (dirtyRows.length === 0) {
          console.log("AUTOSAVE ABORTED: No dirty rows found.");
          return;
      }

      setIsSaving(true);
      try {
        console.log("SENDING POST REQUEST TO /autosave", dirtyRows);
        const res = await fetch(`${API_BASE_URL}/patient-lab-reports/${reportId}/results/autosave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify(dirtyRows)
        });
        if (!res.ok) throw new Error("Failed structure autosave");
        const savedDBRows = await res.json();

        // Update local state ONLY if still mounted
        if (isMountedRef.current) {
           setGroups(prev => prev.map(g => ({
             ...g,
             analytes: g.analytes.map(a => {
               const returnedRow = savedDBRows.find((r: any) => r.lab_analyte_context_id === a.lab_analyte_context_id || r.raw_analyte_label === a.analyte_label);
               if (returnedRow) {
                 return {
                   ...a,
                   id: returnedRow.id,
                   interpretation: returnedRow.interpretation,
                   abnormal_flag_text: returnedRow.abnormal_flag_text,
                   reference_range_text: returnedRow.reference_range_text,
                   isDirty: false
                 };
               }
               return a;
             })
           })));
        }

      } catch (e) {
        console.error("Autosave collision", e);
      } finally {
         setIsSaving(false);
      }

    }, 1000); // 1s Debounce
  };

  const handleValueChange = (groupId: string, analyteIdOrLabel: string, newValue: string) => {
    setGroups(prev => prev.map(g => {
       if (g.groupId !== groupId) return g;
       return {
         ...g,
         analytes: g.analytes.map(a => (a.lab_analyte_context_id === analyteIdOrLabel || a.analyte_label === analyteIdOrLabel) ? { ...a, value: newValue, isDirty: true } : a)
       };
    }));
    triggerAutosave();
  };

  const findAnalyteInGroups = (contextId: string): { groupId: string; groupType: 'TEST' | 'STANDALONE'; analyte: AnalyteRow } | null => {
    for (const group of groups) {
      const found = group.analytes.find(a => a.lab_analyte_context_id === contextId);
      if (found) return { groupId: group.groupId, groupType: group.type, analyte: found };
    }
    return null;
  };

  const handleSelectResult = async (result: any) => {
    setSearchQuery('');
    setShowDropdown(false);
    
    if (result.type === 'ACT') {
      if (groups.some(g => g.groupId === result.id)) return;

      try {
        // 1. Create Test explicitly
        const testRes = await fetch(`${API_BASE_URL}/patient-lab-reports/${reportId}/tests`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
           body: JSON.stringify({ global_act_id: result.id, raw_test_label: result.label })
        });
        const createdTest = await testRes.json();

        // 2. Load context
        const res = await fetch(`${API_BASE_URL}/reference/lab-analyte-contexts/by-acts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ globalActIds: [result.id] })
        });
        const fetchedAnalytes = await res.json();
        
        setGroups(prevGroups => {
          let updatedGroups = [...prevGroups];
          const testGroupAnalytes: AnalyteRow[] = [];

          fetchedAnalytes.forEach((fetched: any) => {
            const existing = findAnalyteInGroups(fetched.id);

            if (existing) {
               if (existing.groupType === 'STANDALONE') {
                 const standaloneIndex = updatedGroups.findIndex(g => g.type === 'STANDALONE');
                 if (standaloneIndex !== -1) {
                    updatedGroups[standaloneIndex] = {
                      ...updatedGroups[standaloneIndex],
                      analytes: updatedGroups[standaloneIndex].analytes.filter(a => a.lab_analyte_context_id !== fetched.id)
                    };
                 }
                 testGroupAnalytes.push({ ...fetched, value: existing.analyte.value, isMoved: true, isDirty: true });
               }
            } else {
               testGroupAnalytes.push({
                 lab_analyte_context_id: fetched.id,
                 analyte_label: fetched.analyte_label,
                 method_label: fetched.method_label,
                 specimen_label: fetched.specimen_label,
                 unit_label: fetched.unit_label,
                 value_type: 'NUMERIC',
                 value: '',
                 isDirty: false
               });
            }
          });

          updatedGroups = updatedGroups.filter(g => g.type !== 'STANDALONE' || g.analytes.length > 0);

          if (testGroupAnalytes.length > 0) {
            updatedGroups.push({
              groupId: result.id,
              testId: createdTest.id,
              type: 'TEST',
              label: result.label,
              analytes: testGroupAnalytes,
              expanded: true
            });
          } else {
            toast.error("Le test choisi n'a pas encore de paramètre configuré, veuillez contactez le laboratoire de votre structure.", { duration: 5000 });
          }
          return updatedGroups;
        });
      } catch (e) {
        console.error("Error linking test analytes:", e);
      }
    } else {
      // ANALYTE Selected
      setGroups(prevGroups => {
        const existing = findAnalyteInGroups(result.id);
        if (existing) return prevGroups;

        let updatedGroups = [...prevGroups];
        let standaloneGroup = updatedGroups.find(g => g.type === 'STANDALONE');
        const newRow: AnalyteRow = {
           lab_analyte_context_id: result.id,
           analyte_label: result.label,
           method_label: result.method_label,
           specimen_label: result.specimen_label,
           unit_label: result.unit_label,
           value_type: 'NUMERIC',
           value: '',
           isDirty: true
        };

        if (standaloneGroup) {
          standaloneGroup.analytes.push(newRow);
        } else {
          updatedGroups.unshift({
             groupId: 'STANDALONE',
             type: 'STANDALONE',
             label: 'Paramètres isolés',
             analytes: [newRow],
             expanded: true
          });
        }
        return updatedGroups;
      });
      triggerAutosave();
    }
  };

  const removeAnalyte = (groupId: string, analyteId: string) => {
    // UI Only deletion for simplicity unless API deletion endpoint is added
    setGroups(prev => prev.map(g => {
       if (g.groupId !== groupId) return g;
       return { ...g, analytes: g.analytes.filter(a => a.lab_analyte_context_id !== analyteId && a.analyte_label !== analyteId) };
    }).filter(g => g.analytes.length > 0));
  };

  const removeGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.groupId !== groupId));
  };

  const toggleGroup = (groupId: string) => {
    setGroups(prev => prev.map(g => g.groupId === groupId ? { ...g, expanded: !g.expanded } : g));
  };

  const submitCorrection = async (groupId: string, rowId: string, newValue: string) => {
    try {
      if (!newValue) return;
      const res = await fetch(`${API_BASE_URL}/patient-lab-reports/results/${rowId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ value_type: 'NUMERIC', numeric_value: Number(newValue.replace(',','.')) })
      });
      if (!res.ok) throw new Error("Correction failed");
      const newDBRow = await res.json();
      
      setGroups(prev => prev.map(g => ({
        ...g,
        analytes: g.analytes.map(a => a.id === rowId ? {
          ...a,
          id: newDBRow.id,
          value: String(newDBRow.numeric_value || ''),
          interpretation: newDBRow.interpretation,
          abnormal_flag_text: newDBRow.raw_abnormal_flag_text,
          status: 'ACTIVE',
          isCorrecting: false
        } : a)
      })));
      setReportStatus('AMENDED');
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la correction");
    }
  };

  const getInterpretationColorInfo = (interp?: string | null, flag?: string | null) => {
    if (!interp) return { colorClass: 'text-gray-800', bgClass: '', icon: null };
    
    if (interp === 'NORMAL') return { colorClass: 'text-emerald-700', bgClass: 'bg-emerald-50', icon: null };
    if (interp.includes('CAUTION')) return { colorClass: 'text-amber-600', bgClass: 'bg-amber-50', icon: <AlertTriangle size={14} className="ml-1 text-amber-500" /> };
    if (interp.includes('ABNORMAL')) {
       let arrow = '!';
       if (flag === 'HIGH') arrow = '↑';
       if (flag === 'LOW') arrow = '↓';
       return { colorClass: 'text-red-600', bgClass: 'bg-red-50', icon: <span className="ml-1 font-bold text-red-500">{arrow}</span> };
    }
    return { colorClass: 'text-gray-800', bgClass: '', icon: null };
  };

  // Turn off "isMoved" animation flag after render
  useEffect(() => {
    const hasMoved = groups.some(g => g.analytes.some(a => a.isMoved));
    if (hasMoved) {
       const timer = setTimeout(() => {
          setGroups(prev => prev.map(g => ({
             ...g,
             analytes: g.analytes.map(a => a.isMoved ? { ...a, isMoved: false } : a)
          })));
       }, 2000);
       return () => clearTimeout(timer);
    }
  }, [groups]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const acts = searchResults.filter(r => r.type === 'ACT');
  const analytes = searchResults.filter(r => r.type === 'ANALYTE');

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* GRID HEADER */}
      <div className="border-b border-gray-200 p-4 bg-white flex justify-between items-center shrink-0 shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Target size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Résultats Structurés</h3>
            <p className="text-[10px] text-gray-500 font-medium">
              Statut: <span className="font-bold">{reportStatus}</span> {isSaving && <span className="ml-2 text-indigo-500 animate-pulse">Enregistrement...</span>}
            </p>
          </div>
        </div>
        
        {reportStatus === 'DRAFT' && (
          <div className="flex space-x-3 items-center search-container flex-1 max-w-lg ml-8 relative">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                ref={searchInputRef}
                type="text" 
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white text-sm transition-all"
                placeholder="Ajouter un bilan complet ou paramètre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              />
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[400px] overflow-y-auto z-50">
                  {acts.length > 0 && (
                      <div className="py-2">
                        <div className="px-4 py-1.5 bg-gray-50 border-y border-gray-100 text-[10px] uppercase font-bold text-gray-400">Tests (Bilans)</div>
                        {acts.map((res) => (
                          <div key={res.id} onClick={() => handleSelectResult(res)} className="px-4 py-3 cursor-pointer hover:bg-gray-50">
                             <p className="text-sm font-bold text-gray-800">{res.label}</p>
                          </div>
                        ))}
                      </div>
                  )}
                  {analytes.length > 0 && (
                      <div className="py-2">
                        <div className="px-4 py-1.5 bg-gray-50 border-y border-gray-100 text-[10px] uppercase font-bold text-gray-400">Paramètres Isolés</div>
                        {analytes.map((res) => (
                          <div key={res.id} onClick={() => handleSelectResult(res)} className="px-4 py-3 cursor-pointer hover:bg-gray-50">
                             <p className="text-sm font-bold text-gray-800">{res.label}</p>
                          </div>
                        ))}
                      </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center space-x-3">
        </div>
      </div>

      {/* GRID BODY */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
          
          {groups.map((group) => (
            <div key={group.groupId} className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-200 overflow-hidden transition-all duration-200">
              
              <div className={`flex justify-between items-center p-3 sm:p-4 transition-colors ${group.type === 'TEST' ? 'bg-indigo-50/50' : 'bg-gray-50'} border-b border-gray-100`}>
                <div className="flex items-center space-x-3 cursor-pointer flex-1" onClick={() => toggleGroup(group.groupId)}>
                  <button className="text-gray-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-white">
                    {group.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <h3 className="font-bold text-gray-800 text-sm">{group.label}</h3>
                  <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-[10px] font-bold text-gray-500">
                    {group.analytes.length}
                  </span>
                </div>
                {reportStatus === 'DRAFT' && (
                  <button onClick={() => removeGroup(group.groupId)} className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors ml-4">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {group.expanded && (
                <div className="p-0">
                  <div className="hidden sm:grid grid-cols-[3fr_1.5fr_1fr_2.5fr_1fr] gap-4 px-6 py-2 bg-gray-50/50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                     <div>Paramètre</div>
                     <div>Méth / Spéc</div>
                     <div>Unité</div>
                     <div className="text-right pr-2">Valeur</div>
                     <div className="text-right">Ref</div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {group.analytes.map((row) => {
                      const { colorClass, bgClass, icon } = getInterpretationColorInfo(row.interpretation, row.abnormal_flag_text);
                      const isLocked = reportStatus === 'VALIDATED' || reportStatus === 'AMENDED';

                      return (
                      <div key={row.lab_analyte_context_id || row.analyte_label} className={`grid grid-cols-1 sm:grid-cols-[3fr_1.5fr_1fr_2.5fr_1fr] gap-3 sm:gap-4 items-center px-4 sm:px-6 py-3 hover:bg-gray-50 transition-colors ${bgClass}`}>
                         <div className="font-medium text-sm text-gray-800 flex items-center">
                           <span className={`w-1.5 h-1.5 rounded-full ${row.interpretation ? colorClass.replace('text-', 'bg-') : 'bg-gray-400'} mr-2.5`}></span>
                           <span className="truncate">{row.analyte_label}</span>
                         </div>
                         
                         <div className="text-xs text-gray-500 truncate sm:block hidden">
                            {row.method_label || '-'} / {row.specimen_label || '-'}
                         </div>
                         <div className="text-[11px] font-mono text-gray-500 truncate sm:block hidden">{row.unit_label || '-'}</div>

                         <div className="flex justify-end items-center space-x-2">
                           <div className="flex items-center">
                             {(isLocked && !row.isCorrecting) ? (
                                <div className={`flex items-center px-3 py-1.5 rounded-md font-bold text-sm ${colorClass}`}>
                                  {row.value} {icon}
                                </div>
                             ) : (
                                <input 
                                  type="text" 
                                  className={`w-full sm:max-w-[120px] border border-gray-300 rounded-md px-3 py-1.5 text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-right shadow-sm ${row.isDirty ? 'bg-amber-50' : 'bg-white'}`}
                                  placeholder="Valeur"
                                  value={row.value || ''}
                                  onChange={(e) => handleValueChange(group.groupId, row.lab_analyte_context_id || row.analyte_label, e.target.value)}
                                  autoFocus={row.isCorrecting}
                                />
                             )}
                           </div>
                           
                           {isLocked && !row.isCorrecting && row.id && (
                             <button onClick={() => {
                               setGroups(prev => prev.map(g => ({ ...g, analytes: g.analytes.map(a => a.id === row.id ? { ...a, isCorrecting: true } : a) })));
                             }} title="Corriger cette valeur (créera un nouvel enregistrement)" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                               <Edit2 size={14} />
                             </button>
                           )}

                           {isLocked && row.isCorrecting && (
                             <div className="flex items-center space-x-1">
                               <button onClick={() => submitCorrection(group.groupId, row.id!, row.value)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={16} /></button>
                               <button onClick={() => {
                                 setGroups(prev => prev.map(g => ({ ...g, analytes: g.analytes.map(a => a.id === row.id ? { ...a, isCorrecting: false } : a) })));
                               }} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={16} /></button>
                             </div>
                           )}
                           
                           {reportStatus === 'DRAFT' && !row.lab_analyte_context_id && (
                              <button onClick={() => removeAnalyte(group.groupId, row.analyte_label)} className="text-gray-300 hover:text-red-500 ml-2"><Trash2 size={16} /></button>
                           )}
                         </div>

                         <div className="text-[11px] text-gray-500 text-right">
                            {row.reference_range_text || '-'}
                         </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

        </div>
      </div>
      
    </div>
  );
};
