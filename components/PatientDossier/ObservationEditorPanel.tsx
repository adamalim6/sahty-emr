import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, Edit2, Info, X, Save, Bold, Italic, Underline as UnderlineIcon, Highlighter, AlignLeft, AlignCenter, AlignRight, List as ListIcon, ListOrdered, ChevronDown, Table as TableIcon, Trash2, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import { api } from '../../services/api';

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';

import { CustomDateAndTimePicker } from '../ui/CustomDateAndTimePicker';
import { ObservationRecord } from '../PatientDossier/Observations'; // Adjust if type is moved later
import { SmartPhrasesExtension, SmartPhraseCursor } from './SmartPhrasesExtension';
import { useSmartPhrases, SmartPhrase } from '../../hooks/useSmartPhrases';

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
                <div className="absolute xl:right-0 xl:left-auto left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg flex flex-col z-50 overflow-hidden w-48 font-normal">
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
        "ul", "ol", "li", "br", "mark",
        "table", "thead", "tbody", "tr", "th", "td", "col", "colgroup"
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

const TipTapEditor = ({ content, onChange, phrases, editable = true }: { content: string, onChange?: (html: string) => void, phrases?: SmartPhrase[], editable?: boolean }) => {
    const editorRef = useRef<any>(null);
    const phrasesRef = useRef<SmartPhrase[]>(phrases || []);

    useEffect(() => {
        phrasesRef.current = phrases || [];
    }, [phrases]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
                code: false,
                codeBlock: false,
                blockquote: false,
                horizontalRule: false,
                bulletList: false,
                orderedList: false,
                listItem: false
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
            FontSize,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            SmartPhraseCursor,
            SmartPhrasesExtension.configure({
                getPhrases: () => phrasesRef.current
            })
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
    }, [editable]);

    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);


    // Effect to update content if it changes externally
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
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button type="button" title="Insérer un tableau" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="p-1.5 rounded hover:bg-gray-200 text-gray-600"><TableIcon size={16} /></button>
                </div>
            )}
            <div className={`flex-1 overflow-y-auto w-full`}>
                <style>{`
                    .ProseMirror table {
                        border-collapse: collapse;
                        table-layout: fixed;
                        width: 100%;
                        margin: 0;
                        overflow: hidden;
                    }
                    .ProseMirror td,
                    .ProseMirror th {
                        min-width: 1em;
                        border: 1px solid #d1d5db;
                        padding: 6px;
                        vertical-align: top;
                        box-sizing: border-box;
                        position: relative;
                    }
                    .ProseMirror th {
                        font-weight: 600;
                        text-align: left;
                        background-color: #f3f4f6;
                    }
                    .ProseMirror .column-resize-handle {
                        position: absolute;
                        right: -1px;
                        top: 0;
                        bottom: -2px;
                        width: 4px;
                        background-color: #3b82f6;
                        pointer-events: none;
                        z-index: 20;
                    }
                    .ProseMirror.resize-cursor {
                        cursor: ew-resize;
                        cursor: col-resize;
                    }
                `}</style>
                <BubbleMenu editor={editor} shouldShow={({ editor }) => editor.isActive('table')} className="bg-white border border-gray-200 shadow-xl rounded-lg p-1 flex gap-1 items-center z-50 overflow-hidden">
                    <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} title="Ajouter une ligne avant" className="p-1.5 hover:bg-green-50 hover:text-green-600 rounded text-gray-600"><ArrowUpToLine size={14} /></button>
                    <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} title="Ajouter une ligne après" className="p-1.5 hover:bg-green-50 hover:text-green-600 rounded text-gray-600"><ArrowDownToLine size={14} /></button>
                    <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} title="Supprimer la ligne" className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded text-gray-600 border-r border-gray-200"><Trash2 size={14} /></button>

                    <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} title="Ajouter une colonne avant" className="p-1.5 hover:bg-green-50 hover:text-green-600 rounded text-gray-600 ml-1"><ArrowLeftToLine size={14} /></button>
                    <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} title="Ajouter une colonne après" className="p-1.5 hover:bg-green-50 hover:text-green-600 rounded text-gray-600"><ArrowRightToLine size={14} /></button>
                    <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} title="Supprimer la colonne" className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded text-gray-600 border-r border-gray-200"><Trash2 size={14} /></button>

                    <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} title="Supprimer le tableau" className="p-1.5 text-rose-500 hover:bg-rose-100 rounded ml-1 font-bold flex items-center gap-1 text-[11px] uppercase tracking-wide px-2"><Trash2 size={12} /> Tableau</button>
                </BubbleMenu>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export function editorContentToPlainText(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Flatten tables
    doc.body.querySelectorAll("table").forEach((table) => {
        let tableText = "\n";
        table.querySelectorAll("tr").forEach((row) => {
            const rowData: string[] = [];
            row.querySelectorAll("th, td").forEach((cell) => {
                rowData.push((cell.textContent || "").trim());
            });
            tableText += rowData.join(" ") + "\n";
        });
        tableText += "\n";
        
        const textNode = doc.createTextNode(tableText);
        table.replaceWith(textNode);
    });

    // Handle block elements
    doc.body.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li").forEach(el => {
        el.appendChild(doc.createTextNode('\n'));
    });
    doc.body.querySelectorAll("br").forEach(br => {
        br.replaceWith(doc.createTextNode('\n'));
    });

    return (doc.body.textContent || "").replace(/\n{3,}/g, '\n\n').trim();
}

interface ObservationEditorPanelProps {
    patientId: string;
    mode: 'CREATE' | 'EDIT' | 'VIEW' | 'ADDENDUM';
    activeNote: Partial<ObservationRecord> | null;
    parentNoteForAddendum: ObservationRecord | null;
    isSaving: boolean;
    setActiveNote: (note: Partial<ObservationRecord>) => void;
    setIsSaving: (saving: boolean) => void;
    onClose: () => void;
    onDiscard: () => void;
    onSaveSuccess: () => void;
}

export const ObservationEditorPanel: React.FC<ObservationEditorPanelProps> = ({ 
    patientId, mode, activeNote, parentNoteForAddendum, isSaving, 
    setActiveNote, setIsSaving, onClose, onDiscard, onSaveSuccess 
}) => {

    if (!activeNote) return null;

    const { phrases } = useSmartPhrases();

    const handleSave = async (intent: 'DRAFT' | 'SIGNED') => {
        if (!activeNote.body_html || activeNote.body_html === '<p></p>') {
            alert("Veuillez saisir le contenu de l'observation.");
            return;
        }

        const plainText = editorContentToPlainText(activeNote.body_html);

        setIsSaving(true);
        try {
            if (mode === 'CREATE') {
                await api.createObservation({
                    tenant_patient_id: patientId,
                    note_type: activeNote.note_type as any,
                    privacy_level: activeNote.privacy_level as any,
                    status: intent,
                    declared_time: activeNote.declared_time as string,
                    body_html: activeNote.body_html,
                    body_text: plainText
                });
            } else if (mode === 'EDIT') {
                await api.updateDraftObservation(activeNote.id as string, {
                    note_type: activeNote.note_type as any,
                    privacy_level: activeNote.privacy_level as any,
                    declared_time: activeNote.declared_time,
                    body_html: activeNote.body_html,
                    body_text: plainText
                });
                if (intent === 'SIGNED') {
                    // Update then sign
                    await api.signObservation(activeNote.id as string);
                }
            } else if (mode === 'ADDENDUM' && parentNoteForAddendum) {
                if (intent === 'DRAFT') {
                    alert("Les addendums doivent être signés immédiatement, ils ne peuvent pas être des brouillons.");
                    setIsSaving(false);
                    return;
                }
                await api.createObservationAddendum(parentNoteForAddendum.id, {
                    declared_time: activeNote.declared_time as string,
                    privacy_level: activeNote.privacy_level as any,
                    body_html: activeNote.body_html,
                    body_text: plainText
                });
            }

            setIsSaving(false);
            onSaveSuccess();
        } catch (err: any) {
            alert("Erreur lors de la sauvegarde: " + err.message);
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full flex flex-col bg-white h-full overflow-hidden shrink-0">
            {/* TOP METADATA STRIP */}
            {(mode !== 'VIEW') && (
                <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-4 z-10 shrink-0 flex-wrap">
                    <div className="flex items-center">
                        <span className="font-bold text-gray-400 uppercase tracking-wide text-[10px] mr-2">Type :</span>
                        <select 
                            value={activeNote.note_type} 
                            onChange={(e) => setActiveNote({...activeNote, note_type: e.target.value as any})} 
                            className="h-7 text-[12px] bg-white border border-gray-200 rounded py-0 pl-2 pr-6 shadow-sm focus:ring-blue-500 font-medium cursor-pointer"
                            disabled={mode === 'ADDENDUM'}
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
                        <span className="font-bold text-gray-400 uppercase tracking-wide text-[10px] mr-2">Confiden...:</span>
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
                {mode === 'ADDENDUM' && parentNoteForAddendum && (
                    <div className="m-4 p-4 border border-indigo-200 bg-indigo-50/50 rounded-lg opacity-80 cursor-not-allowed mx-auto max-w-[750px] w-full shrink-0">
                        <div className="text-xs font-bold text-indigo-800 uppercase mb-2 flex items-center"><Info size={12} className="mr-1"/> Note originale signée (Lecture seule)</div>
                        <div className="prose prose-sm max-w-none text-gray-600 line-clamp-3" dangerouslySetInnerHTML={{__html: parentNoteForAddendum.body_html}} />
                    </div>
                )}
                <TipTapEditor 
                    content={activeNote.body_html || ''} 
                    onChange={(html) => setActiveNote({...activeNote, body_html: html})} 
                    phrases={phrases}
                    editable={mode !== 'VIEW'}
                />
            </div>

            {/* Compact Sticky Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-3 py-1.5 flex items-center justify-between shrink-0 z-20 flex-wrap gap-2">
                {/* Date Left Aligned - Compact */}
                <div className="flex items-center gap-2">
                    <CustomDateAndTimePicker 
                        value={activeNote.declared_time as string} 
                        onChange={(d) => setActiveNote({...activeNote, declared_time: d})} 
                        maxDate={new Date().toISOString()} 
                        dropUp={true}
                    />
                </div>

                {/* Actions Right Aligned - Compact Icons */}
                <div className="flex items-center gap-2 ml-auto">
                    <button 
                        type="button" 
                        onClick={() => {
                            if (mode === 'VIEW') {
                                onClose();
                            } else {
                                if (window.confirm("Êtes-vous sûr de vouloir annuler ce brouillon ? Le texte non sauvegardé sera perdu.")) {
                                    onDiscard();
                                }
                            }
                        }} 
                        className="px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-100 rounded shadow-sm transition-colors flex items-center"
                    >
                        <X size={14} className="mr-1"/> {mode === 'VIEW' ? 'Fermer' : 'Annuler'}
                    </button>
                    
                    {(mode === 'CREATE' || mode === 'EDIT') && (
                        <button 
                            type="button" 
                            onClick={() => handleSave('DRAFT')} 
                            disabled={isSaving}
                            className="px-3 py-1.5 text-[13px] font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded shadow-sm transition-colors flex items-center disabled:opacity-50"
                        >
                            <Save size={14} className="mr-1"/> Brouillon
                        </button>
                    )}

                    {mode !== 'VIEW' && (
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
    );
};
