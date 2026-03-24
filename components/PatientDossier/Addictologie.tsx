import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Cigarette, Wine, Plus, Trash2, Pencil, Save, X, Clock, Zap, MessageSquare,
  Bold, Italic, Underline as UnderlineIcon, Highlighter, List as ListIcon, ListOrdered
} from 'lucide-react';
import { api } from '../../services/api';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { CustomDateAndTimePicker } from '../ui/CustomDateAndTimePicker';

const FIELD_TRANSLATIONS: Record<string, string> = {
    'qty': 'Quantité',
    'unit': 'Unité',
    'frequency': 'Fréquence',
    'status': 'Statut',
    'substance_label': 'Substance',
    'addiction_type': 'Type',
    'stop_motivation_score': 'Motivation d\'arrêt',
    'start_date': 'Date de début',
};

const ADDICTION_TYPE_LABELS: Record<string, string> = {
    'TOBACCO': 'Tabac',
    'ALCOHOL': 'Alcool',
    'CANNABIS': 'Cannabis',
    'OPIOIDS': 'Opioïdes',
    'STIMULANTS': 'Stimulants',
    'BEHAVIORAL': 'Comportementale',
    'OTHER': 'Autre'
};

const formatHistoryValue = (field: string, valStr?: string, valNum?: number) => {
    if (valNum !== null && valNum !== undefined) return valNum;
    if (!valStr) return 'Vide';
    if (field === 'start_date' && valStr) {
        return new Date(valStr).toLocaleDateString('fr-FR');
    }
    return valStr;
};

function cleanPasteHTML(html: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const allowedTags = ["p", "strong", "em", "u", "ul", "ol", "li", "br", "mark"];
    doc.body.querySelectorAll("*").forEach((node) => {
        const tag = node.tagName.toLowerCase();
        if (!allowedTags.includes(tag)) {
            if (node.childNodes.length > 0) {
                node.replaceWith(...Array.from(node.childNodes));
            } else {
                node.remove();
            }
            return;
        }
        node.removeAttribute("class");
        node.removeAttribute("style");
    });
    return doc.body.innerHTML;
}

const MinimalEditor = ({ content, onChange }: { content: string, onChange: (html: string) => void }) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false }),
            BulletList, OrderedList, ListItem, Highlight, Underline,
        ],
        content,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        editorProps: {
            handlePaste(view, event) {
                const html = event.clipboardData?.getData('text/html');
                if (!html) return false;
                event.preventDefault();
                const cleanedHTML = cleanPasteHTML(html);
                const currentEditor = (view as any).editor;
                if (currentEditor) {
                  currentEditor.commands.insertContent(cleanedHTML);
                } else {
                    view.dispatch(view.state.tr.insertText(new DOMParser().parseFromString(cleanedHTML, 'text/html').body.innerText));
                }
                return true;
            }
        }
    });

    if (!editor) return null;

    return (
        <div className="border border-gray-300 rounded-lg overflow-hidden flex flex-col bg-white">
            <div className="flex flex-wrap items-center bg-gray-50 border-b border-gray-200 p-1.5 gap-1 shadow-sm">
                <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}><Bold size={16} /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}><Italic size={16} /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}><UnderlineIcon size={16} /></button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('highlight') ? 'bg-yellow-100 text-yellow-700' : 'text-gray-600'}`}><Highlighter size={16} /></button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('bulletList') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}><ListIcon size={16} /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive('orderedList') ? 'bg-gray-200 text-black' : 'text-gray-600'}`}><ListOrdered size={16} /></button>
            </div>
            <div className="bg-white flex-grow overflow-y-auto" style={{ minHeight: '120px', maxHeight: '200px' }}>
                <EditorContent editor={editor} className="prose prose-sm max-w-none p-3 h-full outline-none" />
            </div>
        </div>
    );
};

export const Addictologie: React.FC = () => {
  const { id: tenantPatientId } = useParams<{ id: string }>();
  const [records, setRecords] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [obsModalAddictionId, setObsModalAddictionId] = useState<string | null>(null);
  const [obsContent, setObsContent] = useState('');
  const [obsDeclaredTime, setObsDeclaredTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // History states
  const [histories, setHistories] = useState<Record<string, any[]>>({});
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});

  const fetchRecords = async () => {
    if (!tenantPatientId) return;

    try {
      const [addictionsRes, obsRes] = await Promise.all([
        api.getPatientAddictions(tenantPatientId),
        api.getPatientObservations(tenantPatientId)
      ]);
      setRecords(addictionsRes);
      // Filter out only the observations linked to addictions
      setObservations(obsRes.filter((o: any) => o.linked_addiction_id != null));

      // Fetch histories for all fetched addictions to display initial counts correctly
      const historiesMap: Record<string, any[]> = {};
      await Promise.all(
          addictionsRes.map(async (ad: any) => {
              try {
                  const hist = await api.getAddictionHistory(ad.id);
                  historiesMap[ad.id] = hist;
              } catch (e) {
                  console.error("Error fetching history for initial count:", e);
              }
          })
      );
      setHistories(historiesMap);
    } catch (err) {
      console.error("Error fetching addictions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [tenantPatientId]);

  const toggleHistory = async (addictionId: string) => {
      const isExpanded = expandedHistories[addictionId];
      if (!isExpanded && !histories[addictionId]) {
          try {
              const hist = await api.getAddictionHistory(addictionId);
              setHistories(prev => ({ ...prev, [addictionId]: hist }));
          } catch (e) {
              console.error("Error fetching history:", e);
          }
      }
      setExpandedHistories(prev => ({ ...prev, [addictionId]: !isExpanded }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData?.substance_label && formData?.addiction_type === 'OTHER') return;

    try {
      if (formData.id) {
        await api.updateAddiction(formData.id, formData);
      } else {
        await api.createAddiction({ ...formData, tenant_patient_id: tenantPatientId });
      }
      setIsModalOpen(false);
      fetchRecords();
    } catch (err) {
      console.error("Error saving addiction:", err);
    }
  };

  const handleSaveObservation = async () => {
    if (!obsModalAddictionId || !obsContent.trim()) return;

    try {
      await api.createAddictionObservation(obsModalAddictionId, {
         body_html: obsContent,
         status: 'SIGNED', // Progress notes in this context are commonly instantly signed or drafted. Keeping consistent.
         declared_time: obsDeclaredTime || new Date().toISOString()
      });
      setObsModalAddictionId(null);
      setObsContent('');
      setObsDeclaredTime('');
      fetchRecords();
    } catch (err) {
      console.error("Error saving observation:", err);
    }
  };

  const openNewModal = () => {
      setFormData({
        addiction_type: 'TOBACCO',
        substance_label: '',
        qty: '',
        unit: '',
        frequency: 'Quotidien',
        status: 'ACTIVE',
        stop_motivation_score: 5,
        start_date: ''
      });
      setIsModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'WITHDRAWAL': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'ABSTINENT': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'RESOLVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
      switch (status) {
        case 'ACTIVE': return 'Actif';
        case 'WITHDRAWAL': return 'En sevrage';
        case 'ABSTINENT': return 'Abstinent';
        case 'RESOLVED': return 'Résolu';
        case 'ENTERED_IN_ERROR': return 'Erreur de saisie';
        default: return status;
      }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement...</div>;

  return (
    <div className="min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Cigarette className="mr-2 text-indigo-600" />
            Addictologie & Dépendances
          </h3>
          <p className="text-sm text-gray-500">Suivi des consommations de substances et addictions comportementales.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          <span>Ajouter un suivi</span>
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Cigarette className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucun antécédent d'addiction enregistré.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {records.map(record => {
            const linkedObs = observations.filter(o => o.linked_addiction_id === record.id);
            return (
              <div key={record.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4 flex-1">
                            <div className={`p-3 rounded-xl ${record.addiction_type === 'ALCOHOL' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                {record.addiction_type === 'ALCOHOL' ? <Wine size={24} /> : <Cigarette size={24} />}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-1">
                                    <h4 className="font-bold text-gray-900 text-lg leading-none">{record.substance_label || ADDICTION_TYPE_LABELS[record.addiction_type] || record.addiction_type}</h4>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border shadow-sm ${getStatusColor(record.status)}`}>
                                        {getStatusLabel(record.status)}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                        {ADDICTION_TYPE_LABELS[record.addiction_type] || record.addiction_type}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center text-sm gap-y-2 gap-x-6 text-gray-600">
                                    <div className="flex items-center font-medium">
                                        <span className="text-gray-400 mr-1.5 font-bold uppercase text-[10px]">Qté:</span>
                                        <span className="text-gray-900 font-bold">
                                            {record.qty && record.unit ? `${record.qty} ${record.unit} ` : '- '} 
                                            {record.frequency ? `(${record.frequency})` : ''}
                                        </span>
                                    </div>
                                    <div className="flex items-center font-medium">
                                        <span className="text-gray-400 mr-2 font-bold uppercase text-[10px]">Motivation D'Arrêt:</span>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div className={`h-full ${record.stop_motivation_score > 7 ? 'bg-emerald-500' : (record.stop_motivation_score || 0) > 4 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${(record.stop_motivation_score || 0) * 10}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-gray-700">{record.stop_motivation_score || 0}/10</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500 font-medium">
                                        <Clock size={12} className="mr-1.5"/> Débuté: <span className="text-gray-900 font-bold ml-1">{record.start_date ? new Date(record.start_date).toLocaleDateString() : 'Inconnu'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 md:border-l md:border-gray-200 md:pl-4">
                            <button onClick={() => {setFormData(record); setIsModalOpen(true);}} className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-transparent hover:border-indigo-100 bg-white" title="Modifier le suivi">
                                <Pencil size={16}/>
                            </button>
                             <button 
                                onClick={() => {
                                    setObsModalAddictionId(record.id);
                                    setObsContent('');
                                    const now = new Date();
                                    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                                    setObsDeclaredTime(now.toISOString().slice(0, 16));
                                }}
                                className="flex items-center space-x-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors font-bold text-sm shadow-sm"
                             >
                                <MessageSquare size={14} />
                                <span>Nouvelle Note</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Historique des Modifications (Collapsible) */}
                <div className="border-b border-gray-100">
                    <button 
                        onClick={() => toggleHistory(record.id)}
                        className="w-full flex items-center justify-between px-5 py-2 hover:bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider transition-colors"
                    >
                        <span>Historique des modifications ({histories[record.id]?.length || 0})</span>
                        <span className="text-indigo-400">{expandedHistories[record.id] ? 'Masquer' : 'Afficher'}</span>
                    </button>
                    {expandedHistories[record.id] && histories[record.id] && (
                        <div className="bg-gray-50/50 px-5 pb-4 pt-2 border-t border-gray-100">
                            {histories[record.id].length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Aucune modification enregistrée.</p>
                            ) : (
                                <div className="space-y-2">
                                    {histories[record.id].map((h: any) => (
                                        <div key={h.id} className="text-xs flex items-start space-x-2 bg-white p-2 rounded border border-gray-100 shadow-sm">
                                            <div className="text-gray-400 min-w-[120px]">
                                                {new Date(h.changed_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-bold text-gray-700">{FIELD_TRANSLATIONS[h.field_name] || h.field_name}</span>: 
                                                <span className="line-through text-gray-400 mx-1">{formatHistoryValue(h.field_name, h.old_value_text, h.old_value_number)}</span>
                                                <span className="text-blue-600 font-medium">➔ {formatHistoryValue(h.field_name, h.new_value_text, h.new_value_number)}</span>
                                            </div>
                                            <div className="text-gray-500 font-medium">
                                                Par: {h.changed_by_first_name} {h.changed_by_last_name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Notes Cliniques (Progression) */}
                {linkedObs.length > 0 && (
                    <div className="p-5 bg-white">
                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-l-2 border-gray-300 pl-2">Notes Cliniques</h5>
                        <div className="space-y-4">
                            {linkedObs.map((obs: any) => (
                                <div key={obs.id} className="relative pl-4 pr-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-lg opacity-80"></div>
                                    <div className="flex justify-between items-start mb-2 border-b border-gray-200 pb-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-[10px] items-center flex font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase border border-indigo-200 shadow-sm">
                                                <MessageSquare size={10} className="mr-1"/> {obs.note_type}
                                            </span>
                                            <span className="text-xs font-bold text-gray-800 flex items-center">
                                                {obs.author_first_name} {obs.author_last_name}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-bold flex items-center bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">
                                            <Clock size={10} className="mr-1 text-gray-400" />
                                            {new Date(obs.declared_time || obs.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </div>
                                    </div>
                                    <div 
                                        className="text-sm text-gray-800 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-strong:text-indigo-900" 
                                        dangerouslySetInnerHTML={{ __html: obs.body_html }} 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- Addiction Editor Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Zap size={20} className="mr-2 text-indigo-600"/>
                {formData?.id ? 'Modifier le suivi' : 'Nouveau suivi Addicto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Type d'addiction *</label>
                  <select name="addiction_type" value={formData?.addiction_type} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white">
                    <option value="TOBACCO">Tabac</option>
                    <option value="ALCOHOL">Alcool</option>
                    <option value="CANNABIS">Cannabis</option>
                    <option value="OPIOIDS">Opioïdes</option>
                    <option value="STIMULANTS">Stimulants</option>
                    <option value="BEHAVIORAL">Comportementale</option>
                    <option value="OTHER">Autres substances</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Substance / Activité *</label>
                  <input type="text" name="substance_label" value={formData?.substance_label || ''} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" placeholder="Ex: Marlboro, Vodka, Jeu..." />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Qté</label>
                  <input type="number" name="qty" value={formData?.qty || ''} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" placeholder="10" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Unité</label>
                  <input type="text" name="unit" value={formData?.unit || ''} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm" placeholder="cig, verres..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Fréquence</label>
                  <select name="frequency" value={formData?.frequency || 'Quotidien'} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white">
                    <option value="Quotidien">Quotidien</option>
                    <option value="Pluri-hebdomadaire">Pluri-hebdomadaire</option>
                    <option value="Hebdomadaire">Hebdomadaire</option>
                    <option value="Occasionnel">Occasionnel</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Statut actuel</label>
                  <select name="status" value={formData?.status} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 text-sm bg-white">
                    <option value="ACTIVE">Actif</option>
                    <option value="WITHDRAWAL">En sevrage</option>
                    <option value="ABSTINENT">Sevré / Abstinent</option>
                    <option value="RESOLVED">Résolu</option>
                    <option value="ENTERED_IN_ERROR">Erreur de saisie</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Motivation arrêt (0-10)</label>
                  <input type="range" name="stop_motivation_score" min="0" max="10" value={formData?.stop_motivation_score || 0} onChange={handleInputChange} className="w-full accent-indigo-600 mt-2" />
                  <div className="flex justify-between text-[10px] text-gray-400 font-bold px-1"><span>0</span><span>5</span><span>10</span></div>
                </div>
              </div>

              <div>
                <CustomDatePicker
                    label="Date de début (approx.)"
                    value={formData?.start_date?.split('T')[0] || ''}
                    onChange={(date) => setFormData((prev: any) => ({ ...prev, start_date: date }))}
                    disableFuture={true}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">Annuler</button>
              <button onClick={handleSave} className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50">
                <Save size={18} className="mr-2"/> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Observation Clinique Modal --- */}
      {obsModalAddictionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <MessageSquare size={20} className="mr-2 text-indigo-600"/>
                        Ajouter une Note Clinique (Progression)
                    </h3>
                    <button onClick={() => setObsModalAddictionId(null)} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6 flex-grow bg-white flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Contenu de la note *</label>
                        <MinimalEditor content={obsContent} onChange={setObsContent} />
                    </div>
                    <div className="max-w-[300px]">
                        <label className="flex text-sm font-bold text-gray-700 mb-2 items-center gap-1.5">
                            <Clock size={16} className="text-gray-500" /> Date et Heure de l'observation
                        </label>
                        <CustomDateAndTimePicker
                            value={obsDeclaredTime || new Date().toISOString()}
                            onChange={(date) => setObsDeclaredTime(date)}
                            maxDate={new Date().toISOString()}
                            dropUp={true}
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 mt-auto rounded-b-2xl">
                    <button onClick={() => setObsModalAddictionId(null)} className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">Annuler</button>
                    <button onClick={handleSaveObservation} disabled={!obsContent.trim()} className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center disabled:opacity-50">
                        <Save size={18} className="mr-2"/> Enregistrer la Note
                    </button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};