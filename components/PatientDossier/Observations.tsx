import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, Edit2, Info, X, Save, Clock, User, ShieldAlert, FileText, FilePlus, Bold, Italic, Underline as UnderlineIcon, Highlighter, AlignLeft, AlignCenter, AlignRight, List as ListIcon, ListOrdered, ChevronDown } from 'lucide-react';
import { api } from '../../services/api';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { CustomDateAndTimePicker } from '../ui/CustomDateAndTimePicker';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import sanitizeHtml from 'sanitize-html';

export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

export interface ObservationRecord {
    id: string;
    note_type: 'ADMISSION' | 'PROGRESS' | 'DISCHARGE' | 'CONSULT' | 'GENERAL';
    privacy_level: 'NORMAL' | 'SENSITIVE' | 'RESTRICTED';
    author_role: 'DOCTOR' | 'NURSE';
    status: 'DRAFT' | 'SIGNED';
    declared_time: string;
    created_at: string;
    author_first_name?: string;
    author_last_name?: string;
    created_by: string; // uuid
    parent_observation_id?: string;
    body_html: string;
    body_plain: string;
}

const inputClassName = "block w-full rounded-lg border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400";
const labelClassName = "block text-sm font-bold text-gray-700 mb-1.5";


const ListFormatDropdown = ({ editor }: { editor: any }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative flex items-center" ref={ref}>
            <button 
                type="button" 
                onClick={() => {
                    if (editor.isActive('orderedList')) {
                        editor.chain().focus().toggleOrderedList().run();
                    } else {
                        editor.chain().focus().toggleBulletList().run();
                    }
                }} 
                className={`p-1.5 rounded-l hover:bg-gray-200 ${(editor.isActive('bulletList') || editor.isActive('orderedList')) ? 'bg-gray-200 text-black' : ''}`}
                title="Liste"
            >
                {editor.isActive('orderedList') ? <ListOrdered size={16} /> : <ListIcon size={16} />}
            </button>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 px-0.5 border-l border-gray-300 rounded-r hover:bg-gray-200 flex items-center justify-center"
            >
                <ChevronDown size={14} className="text-gray-500" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col z-50 overflow-hidden w-48 font-normal">
                    <button 
                        type="button" 
                        onClick={() => { editor.chain().focus().toggleBulletList().run(); setIsOpen(false); }} 
                        className={`px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2 ${editor.isActive('bulletList') ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                    >
                        <ListIcon size={16} /> Liste à puces
                    </button>
                    <button 
                        type="button" 
                        onClick={() => { editor.chain().focus().toggleOrderedList().run(); setIsOpen(false); }} 
                        className={`px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2 ${editor.isActive('orderedList') ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                    >
                        <ListOrdered size={16} /> Liste numérotée
                    </button>
                </div>
            )}
        </div>
    );
};

function cleanPasteHTML(html: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const allowedTags = [
        "p", "strong", "em", "u", "h1", "h2", "h3",
        "ul", "ol", "li", "br", "mark"
    ];

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

// Rich Text Editor Component
const TipTapEditor = ({ content, onChange, editable = true }: { content: string, onChange?: (html: string) => void, editable?: boolean }) => {
    const editorRef = useRef<any>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
                code: false,
                codeBlock: false,
                blockquote: false,
                horizontalRule: false
            }),
            Heading.configure({
                levels: [2, 3]
            }),
            BulletList,
            OrderedList,
            ListItem,
            Highlight,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Underline,
            TextStyle,
            FontFamily,
            FontSize
        ],
        content: content,
        editable: editable,
        onUpdate: ({ editor }) => {
            if (onChange) onChange(editor.getHTML());
        },
        editorProps: {
            handlePaste(view, event) {
                const html = event.clipboardData?.getData('text/html');

                if (!html) {
                    return false;
                }

                event.preventDefault();

                const cleanedHTML = cleanPasteHTML(html);

                if (editorRef.current) {
                    editorRef.current.commands.insertContent(cleanedHTML);
                }

                return true;
            }
        }
    }, [editable]); // re-init if edit mode changes but mainly handles read-only state.

    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);

    // Effect to update content if it changes externally (like when selecting a different note)
    useEffect(() => {
        if (editor && editor.getHTML() !== content && !editor.isFocused) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) return null;

    return (
        <div className="flex flex-col h-full w-full bg-white relative">
            {editable && (
                <div className="bg-gray-50 border-b border-gray-200 p-2 flex gap-1 flex-wrap items-center text-gray-600 shrink-0 sticky top-0 z-10">
                    <select 
                        onChange={(e) => {
                            if (e.target.value === '13px') {
                                (editor.chain().focus() as any).unsetFontSize().run();
                            } else {
                                (editor.chain().focus() as any).setFontSize(e.target.value).run();
                            }
                        }}
                        className="h-7 text-xs rounded border-gray-300 py-0 pl-2 pr-6 bg-white cursor-pointer font-medium"
                        value={editor.getAttributes('textStyle').fontSize || "13px"}
                    >
                        <option value="13px">13</option>
                        <option value="15px">15</option>
                        <option value="18px">18</option>
                    </select>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>

                    <button type="button" title="Gras" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 flex justify-center items-center rounded hover:bg-gray-200 ${editor.isActive('bold') ? 'bg-gray-200 text-black font-bold' : ''}`}><Bold size={16} /></button>
                    <button type="button" title="Italique" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 flex justify-center items-center rounded hover:bg-gray-200 ${editor.isActive('italic') ? 'bg-gray-200 text-black font-bold' : ''}`}><Italic size={16} /></button>
                    <button type="button" title="Souligné" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 flex justify-center items-center rounded hover:bg-gray-200 ${editor.isActive('underline') ? 'bg-gray-200 text-black font-bold' : ''}`}><UnderlineIcon size={16} /></button>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button type="button" title="Titre de section" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-black' : ''}`}>H2</button>
                    <button type="button" title="Sous-titre" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`px-2 py-1 text-xs font-bold rounded hover:bg-gray-200 ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 text-black' : ''}`}>H3</button>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    
                    <ListFormatDropdown editor={editor} />
                    
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button type="button" title="Surligner" onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-1.5 flex justify-center items-center rounded hover:bg-gray-200 ${editor.isActive('highlight') ? 'bg-gray-200 text-black' : ''}`}><Highlighter size={16} className={editor.isActive('highlight') ? 'text-yellow-500' : ''} /></button>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button type="button" title="Aligner à gauche" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200 text-black' : ''}`}><AlignLeft size={16} /></button>
                    <button type="button" title="Centrer" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200 text-black' : ''}`}><AlignCenter size={16} /></button>
                    <button type="button" title="Aligner à droite" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-1.5 rounded hover:bg-gray-200 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200 text-black' : ''}`}><AlignRight size={16} /></button>
                </div>
            )}
            <div className={`flex-1 overflow-y-auto w-full`}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

interface ObservationsProps {
    patientId: string;
    isActiveWorkspace?: boolean;
    isActiveTab?: boolean;
}

export const Observations: React.FC<ObservationsProps> = ({ patientId, isActiveWorkspace = true, isActiveTab = true }) => {
    const [observations, setObservations] = useState<ObservationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [filterAuthor, setFilterAuthor] = useState<'ALL' | 'DOCTOR' | 'NURSE' | 'MINE'>('ALL');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'DRAFT' | 'SIGNED'>('ALL');
    
    // Editor State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'CREATE' | 'EDIT' | 'VIEW' | 'ADDENDUM'>('CREATE');
    const [activeNote, setActiveNote] = useState<Partial<ObservationRecord>>({});
    const [parentNoteForAddendum, setParentNoteForAddendum] = useState<ObservationRecord | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

    // In a real app we'd get the actual user ID from a context provider, assuming here it's accessible or we omit 'MINE' filter logic for now if unavailable locally.
    const currentUserId = ""; // TODO: If user UUID is needed for 'MINE' filter, pass it as prop or fetch from auth context.

    const loadObservations = async () => {
        setLoading(true);
        try {
            const data = await api.getPatientObservations(patientId);
            setObservations(data);
        } catch (err: any) {
            console.error("Failed to load observations", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (patientId) loadObservations();
    }, [patientId]);

    const openCreateForm = () => {
        setEditorMode('CREATE');
        setActiveNote({
            note_type: 'GENERAL',
            privacy_level: 'NORMAL',
            status: 'DRAFT',
            declared_time: new Date().toISOString(),
            body_html: ''
        });
        setParentNoteForAddendum(null);
        setIsEditorOpen(true);
    };

    const openEditDraft = (obs: ObservationRecord) => {
        setEditorMode('EDIT');
        setActiveNote({...obs});
        setParentNoteForAddendum(null);
        setIsEditorOpen(true);
    };

    const openAddendum = (parent: ObservationRecord) => {
        setEditorMode('ADDENDUM');
        setActiveNote({
            declared_time: new Date().toISOString(), // Addendum time
            privacy_level: parent.privacy_level,
            body_html: ''
        });
        setParentNoteForAddendum(parent);
        setIsEditorOpen(true);
    };

    const openViewOnly = (obs: ObservationRecord) => {
        setEditorMode('VIEW');
        setActiveNote(obs);
        setParentNoteForAddendum(null);
        setIsEditorOpen(true);
    };

    const handleSave = async (intent: 'DRAFT' | 'SIGNED') => {
        if (!activeNote.body_html || activeNote.body_html === '<p></p>') {
            alert("Veuillez saisir le contenu de l'observation.");
            return;
        }

        setIsSaving(true);
        try {
            if (editorMode === 'CREATE') {
                await api.createObservation({
                    tenant_patient_id: patientId,
                    note_type: activeNote.note_type as any,
                    privacy_level: activeNote.privacy_level as any,
                    status: intent,
                    declared_time: activeNote.declared_time as string,
                    body_html: activeNote.body_html
                });
            } else if (editorMode === 'EDIT') {
                await api.updateDraftObservation(activeNote.id as string, {
                    note_type: activeNote.note_type as any,
                    privacy_level: activeNote.privacy_level as any,
                    declared_time: activeNote.declared_time,
                    body_html: activeNote.body_html
                });
                if (intent === 'SIGNED') {
                    // Update then sign
                    await api.signObservation(activeNote.id as string);
                }
            } else if (editorMode === 'ADDENDUM' && parentNoteForAddendum) {
                if (intent === 'DRAFT') {
                    alert("Les addendums doivent être signés immédiatement, ils ne peuvent pas être des brouillons.");
                    setIsSaving(false);
                    return;
                }
                await api.createObservationAddendum(parentNoteForAddendum.id, {
                    declared_time: activeNote.declared_time as string,
                    privacy_level: activeNote.privacy_level as any,
                    body_html: activeNote.body_html
                });
            }

            await loadObservations();
            setIsEditorOpen(false);
        } catch (err: any) {
            alert("Erreur lors de la sauvegarde: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleExpansion = (id: string) => {
        setExpandedNotes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Filter Logic
    const DisplayedObservations = observations.filter(obs => {
        if (filterAuthor === 'DOCTOR' && obs.author_role !== 'DOCTOR') return false;
        if (filterAuthor === 'NURSE' && obs.author_role !== 'NURSE') return false;
        if (filterStatus !== 'ALL' && obs.status !== filterStatus) return false;
        // if (filterAuthor === 'MINE' && obs.created_by !== currentUserId) return false; // Enable if currentUserId is known globally
        return true;
    });

    // Structure for parent/child hierarchy
    const primaryNotes = DisplayedObservations.filter(o => !o.parent_observation_id);
    const addendums = DisplayedObservations.filter(o => o.parent_observation_id);

    // Date formatter
    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: '2-digit', minute:'2-digit' });
    };

    return (
        <div className="flex h-full min-h-0 w-full overflow-hidden bg-white shadow-sm border border-gray-200 rounded-xl">
            {/* LEFT SIDE: NOTE LIST */}
            <div className={`p-6 transition-all duration-300 ease-in-out ${isEditorOpen ? 'w-1/2 border-r border-gray-200 bg-white' : 'w-full'} overflow-y-auto`}>
                
                {/* Filters Toolbar */}
                <div className="flex flex-wrap gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-200 shadow-sm justify-between items-center relative">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center space-x-1 border-r border-gray-200 pr-3">
                            <span className="text-xs font-bold text-gray-400 mr-2 uppercase">Auteur:</span>
                            {['ALL', 'DOCTOR', 'NURSE'].map(role => (
                                <button 
                                    key={role}
                                    onClick={() => setFilterAuthor(role as any)}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filterAuthor === role ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {role === 'ALL' ? 'Tous' : role === 'DOCTOR' ? 'Médecins' : 'Infirmiers'}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center space-x-1 pl-1">
                            <span className="text-xs font-bold text-gray-400 mr-2 uppercase">Statut:</span>
                            {['ALL', 'SIGNED', 'DRAFT'].map(stat => (
                                <button 
                                    key={stat}
                                    onClick={() => setFilterStatus(stat as any)}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${filterStatus === stat ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    {stat === 'ALL' ? 'Tous' : stat === 'SIGNED' ? 'Signées' : 'Brouillons'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {!isEditorOpen && (
                        <button 
                            onClick={openCreateForm}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs rounded-lg font-bold shadow-sm transition-colors flex items-center gap-1.5 ml-auto"
                        >
                            <Plus size={14} strokeWidth={3} />
                            Nouvelle Observation
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="text-center py-12"><div className="animate-pulse flex flex-col items-center"><div className="h-10 w-10 bg-gray-200 rounded-full mb-4"></div><div className="h-4 w-32 bg-gray-200 rounded"></div></div></div>
                ) : primaryNotes.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-gray-200 border-dashed rounded-xl">
                        <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-gray-900 font-medium">Aucune observation trouvée</h3>
                        <p className="text-gray-500 text-sm mt-1">Modifiez les filtres ou créez une nouvelle note.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {primaryNotes.map(note => {
                            const isDraft = note.status === 'DRAFT';
                            const noteAddendums = addendums.filter(a => a.parent_observation_id === note.id);
                            const isExpanded = expandedNotes.has(note.id);
                            const previewText = note.body_plain.slice(0, 300) + (note.body_plain.length > 300 ? '...' : '');
                            const needsExpansion = note.body_plain.length > 300 || noteAddendums.length > 0;

                            return (
                                <div key={note.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${isDraft ? 'border-amber-300' : 'border-gray-200 hover:border-gray-300'}`}>
                                    {/* Header */}
                                    <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex justify-between items-start">
                                        <div className="flex items-start gap-3">
                                            <div className="pt-1">
                                                {note.author_role === 'DOCTOR' ? (
                                                    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs" title="Médecin">MD</div>
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xs" title="Infirmier">IDE</div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-900 text-sm">
                                                        {note.author_role === 'DOCTOR' ? 'Dr.' : 'Inf.'} {note.author_last_name} {note.author_first_name?.charAt(0)}.
                                                    </span>
                                                    <span className="text-xs text-gray-400">&bull;</span>
                                                    <span className="text-xs font-medium text-gray-500">{formatDateTime(note.declared_time)}</span>
                                                    {isDraft && <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Brouillon</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded-sm">{note.note_type}</span>
                                                    {note.privacy_level !== 'NORMAL' && <span className="text-[10px] uppercase font-bold text-rose-600 border border-rose-200 bg-rose-50 px-1.5 py-0.5 rounded-sm"><ShieldAlert size={10} className="inline mr-1 pb-[1px]"/>{note.privacy_level}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isDraft ? (
                                                <button onClick={() => openEditDraft(note)} className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors flex items-center border border-blue-200">
                                                    <Edit2 size={12} className="mr-1.5"/> Reprendre
                                                </button>
                                            ) : (
                                                <>
                                                    <button onClick={() => openViewOnly(note)} className="text-gray-400 hover:text-gray-700 bg-white border border-gray-200 px-2.5 py-1.5 rounded-md hover:bg-gray-50 transition-colors" title="Détails">
                                                        <Info size={14} />
                                                    </button>
                                                    <button onClick={() => openAddendum(note)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors flex items-center border border-indigo-200">
                                                        <FilePlus size={12} className="mr-1.5"/> Addendum
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Body content */}
                                    <div className="p-4">
                                        {isExpanded ? (
                                            <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{__html: note.body_html}} />
                                        ) : (
                                            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{previewText}</div>
                                        )}

                                        {/* Toggle Expand Button */}
                                        {needsExpansion && (
                                            <button onClick={() => toggleExpansion(note.id)} className="text-xs font-bold text-blue-600 hover:text-blue-800 mt-3 pt-3 border-t border-gray-100 w-full text-left flex items-center justify-center">
                                                {isExpanded ? 'Réduire' : `Afficher la suite (${noteAddendums.length > 0 ? noteAddendums.length + ' Addendums' : 'Note complète'})`}
                                            </button>
                                        )}

                                        {/* Nested Addendums Rendering inside expanding block */}
                                        {isExpanded && noteAddendums.length > 0 && (
                                            <div className="mt-5 space-y-3 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-0.5 before:bg-indigo-100 ml-4">
                                                {noteAddendums.reverse().map(add => (
                                                    <div key={add.id} className="relative flex items-start group">
                                                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-indigo-200 text-indigo-700 shadow shrink-0 z-10">
                                                            <Plus size={10} strokeWidth={3}/>
                                                        </div>
                                                        <div className="ml-3 w-full bg-slate-50 border border-indigo-100 p-3 rounded-lg shadow-sm">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-indigo-900 text-xs uppercase tracking-wide">Addendum</span>
                                                                    <span className="text-[10px] text-gray-500 font-medium bg-gray-200 px-1 rounded">{formatDateTime(add.declared_time)}</span>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-gray-500">
                                                                    Par {add.author_role === 'DOCTOR' ? 'Dr.' : 'Inf.'} {add.author_last_name}
                                                                </span>
                                                            </div>
                                                            <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{__html: add.body_html}} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* RIGHT SIDE: EDITOR PANEL */}
            {isEditorOpen && (
                <div className="w-1/2 flex flex-col bg-white border-l border-gray-200 shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.05)] h-full overflow-hidden shrink-0 transform translate-x-0 animate-in slide-in-from-right duration-300">
                    
                    {/* TOP METADATA STRIP */}
                    {(editorMode !== 'VIEW') && (
                        <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-4 z-10 shrink-0">
                            <div className="flex items-center">
                                <span className="font-bold text-gray-400 uppercase tracking-wide text-[10px] mr-2">Type :</span>
                                <select 
                                    value={activeNote.note_type} 
                                    onChange={(e) => setActiveNote({...activeNote, note_type: e.target.value as any})} 
                                    className="h-7 text-[12px] bg-white border border-gray-200 rounded py-0 pl-2 pr-6 shadow-sm focus:ring-blue-500 font-medium cursor-pointer"
                                    disabled={editorMode === 'ADDENDUM'}
                                >
                                    <option value="GENERAL">Note Générale</option>
                                    <option value="PROGRESS">Note de Suivi (Progress)</option>
                                    <option value="ADMISSION">Note d'Admission</option>
                                    <option value="CONSULT">Note de Consultation</option>
                                    <option value="DISCHARGE">Note de Sortie</option>
                                </select>
                            </div>
                            
                            <div className="w-px h-4 bg-gray-300"></div>
                            
                            <div className="flex items-center">
                                <span className="font-bold text-gray-400 uppercase tracking-wide text-[10px] mr-2">Confidentialité :</span>
                                <select 
                                    value={activeNote.privacy_level} 
                                    onChange={(e) => setActiveNote({...activeNote, privacy_level: e.target.value as any})} 
                                    className={`h-7 text-[12px] py-0 pl-2 pr-6 border rounded shadow-sm focus:ring-blue-500 cursor-pointer ${activeNote.privacy_level !== 'NORMAL' ? 'text-rose-700 bg-rose-50 border-rose-200 font-bold' : 'bg-white border-gray-200 font-medium'}`}
                                >
                                    <option value="NORMAL">Normal</option>
                                    <option value="SENSITIVE">Sensible</option>
                                    <option value="RESTRICTED">Restreint</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Editor Canvas Container (Scrollable internally) */}
                    <div className="flex-1 overflow-hidden relative flex flex-col min-h-0 bg-white">
                        {/* If addendum, show locked parent preview overlayed inside canvas */}
                        {editorMode === 'ADDENDUM' && parentNoteForAddendum && (
                            <div className="m-4 p-4 border border-indigo-200 bg-indigo-50/50 rounded-lg opacity-80 cursor-not-allowed mx-auto max-w-[750px] w-full shrink-0">
                                <div className="text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center"><Info size={12} className="mr-1"/> Note originale signée (Lecture seule)</div>
                                <div className="prose prose-sm max-w-none text-gray-600 line-clamp-3" dangerouslySetInnerHTML={{__html: parentNoteForAddendum.body_html}} />
                            </div>
                        )}
                        <TipTapEditor 
                            content={activeNote.body_html || ''} 
                            onChange={(html) => setActiveNote({...activeNote, body_html: html})} 
                            editable={editorMode !== 'VIEW'}
                        />
                    </div>

                    {/* Compact Sticky Footer */}
                    <div className="bg-gray-50 border-t border-gray-200 px-3 py-1.5 flex items-center justify-between shrink-0 z-20">
                        {/* Date Left Aligned - Compact */}
                        <div className="flex items-center gap-2 w-56">
                            <CustomDateAndTimePicker 
                                value={activeNote.declared_time as string} 
                                onChange={(d) => setActiveNote({...activeNote, declared_time: d})} 
                                maxDate={new Date().toISOString()} 
                                dropUp={true}
                            />
                        </div>

                        {/* Actions Right Aligned - Compact Icons */}
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setIsEditorOpen(false)} className="px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-100 rounded shadow-sm transition-colors flex items-center">
                                <X size={14} className="mr-1"/> {editorMode === 'VIEW' ? 'Fermer' : 'Annuler'}
                            </button>
                            
                            {(editorMode === 'CREATE' || editorMode === 'EDIT') && (
                                <button 
                                    type="button" 
                                    onClick={() => handleSave('DRAFT')} 
                                    disabled={isSaving}
                                    className="px-3 py-1.5 text-[13px] font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded shadow-sm transition-colors flex items-center disabled:opacity-50"
                                >
                                    <Save size={14} className="mr-1"/> Brouillon
                                </button>
                            )}

                            {editorMode !== 'VIEW' && (
                                <button 
                                    type="button" 
                                    onClick={() => handleSave('SIGNED')} 
                                    disabled={isSaving}
                                    className="px-4 py-1.5 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors flex items-center disabled:opacity-50"
                                >
                                    <Check strokeWidth={3} size={14} className="mr-1"/> Signer
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
