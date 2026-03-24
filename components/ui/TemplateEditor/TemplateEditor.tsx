import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline } from '@tiptap/extension-underline';
import { Bold, Italic, Strikethrough, List, ListOrdered, Grid, Undo, Redo, AlignLeft, AlignCenter, AlignRight, AlignJustify, Underline as UnderlineIcon, Highlighter, Pointer } from 'lucide-react';
import { SmartTokenNode, deserializeTokensFromDB, serializeTokensToDB } from './SmartTokenNode';
import { SmartTokenAtSuggestion, SmartTokenSlashSuggestion } from './SmartTokenSuggestionExtension';
import toast from 'react-hot-toast';
import { Extension } from '@tiptap/core';

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

interface TemplateEditorProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    availablePhrases?: any[];
    currentTrigger?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) return null;

    const insertTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    
    // We keep cursor in the toolbar for fast access, but also in @ menu
    const insertCursor = () => {
        let hasCursor = false;
        editor.state.doc.descendants((node: any) => {
            if (node.type.name === 'smartToken' && node.attrs.tokenId === 'cursor') {
                hasCursor = true;
            }
        });
        if (hasCursor) {
            toast.error('Un seul curseur est autorisé par template');
            return;
        }
        editor.chain().focus().insertContent({ type: 'smartToken', attrs: { tokenId: 'cursor' } }).run();
    };

    return (
        <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 overflow-x-auto rounded-t-lg">
            {/* Standard Text Formatting */}
            <select 
                onChange={(e) => {
                    if (e.target.value === '13px') {
                        (editor.chain().focus() as any).unsetFontSize().run();
                    } else {
                        (editor.chain().focus() as any).setFontSize(e.target.value).run();
                    }
                }}
                className="h-8 text-xs rounded-lg border border-slate-200 py-0 pl-2 pr-6 bg-white cursor-pointer font-medium hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={editor.getAttributes('textStyle').fontSize || "13px"}
            >
                <option value="13px">13</option>
                <option value="15px">15</option>
                <option value="18px">18</option>
            </select>
            <div className="w-px h-5 bg-slate-300 mx-1"></div>
            
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Gras"
            ><Bold size={16} /></button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Italique"
            ><Italic size={16} /></button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('strike') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Barré"
            ><Strikethrough size={16} /></button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('underline') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Souligné"
            ><UnderlineIcon size={16} /></button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('highlight') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Surligner"
            ><Highlighter size={16} /></button>

            <div className="w-px h-5 bg-slate-300 mx-1"></div>

            {/* Alignment */}
            <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Aligner à gauche"
            ><AlignLeft size={16} /></button>
            <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Centrer"
            ><AlignCenter size={16} /></button>
            <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Aligner à droite"
            ><AlignRight size={16} /></button>
            <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive({ textAlign: 'justify' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Justifier"
            ><AlignJustify size={16} /></button>

            <div className="w-px h-5 bg-slate-300 mx-1"></div>

            {/* Lists */}
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Liste à puces"
            ><List size={16} /></button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
                title="Liste numérotée"
            ><ListOrdered size={16} /></button>
            
            <div className="w-px h-5 bg-slate-300 mx-1"></div>

            {/* Table */}
            <button
                type="button"
                onClick={insertTable}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
                title="Insérer un tableau 3x3"
            ><Grid size={16} /></button>

            <div className="w-px h-5 bg-slate-300 mx-1"></div>

            {/* Undo/Redo */}
            <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Annuler"
            ><Undo size={16} /></button>
            <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Rétablir"
            ><Redo size={16} /></button>

            <div className="flex-1"></div>

            {/* Cursor shortcut */}
            <button
                type="button"
                onClick={insertCursor}
                className="flex items-center py-1.5 px-3 text-[11px] font-bold rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
                title="Position Curseur"
            >
                <Pointer size={14} className="mr-1.5" />
                curseur
            </button>
        </div>
    );
};

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ value, onChange, disabled = false, availablePhrases = [], currentTrigger = '' }) => {
    
    // Convert value safely before loading into TipTap
    const initialContent = deserializeTokensFromDB(value || '<p></p>');

    const getAtTokens = () => [
        { id: 'vitals', trigger: 'vitals', label: 'Dernières constantes' },
        { id: 'allergies', trigger: 'allergies', label: 'Allergies actives' },
        { id: 'addictions', trigger: 'addictions', label: 'Addictions actives' },
        { id: 'cursor', trigger: 'cursor', label: 'Positionner le curseur' }
    ];

    const getSlashTokens = () => {
        // Exclude the phrase currently being edited to prevent direct cycle
        return availablePhrases
            .filter(p => p.trigger && p.trigger !== currentTrigger)
            .map(p => ({
                id: p.trigger,
                trigger: p.trigger,
                label: p.label || p.description || 'Smart Phrase',
                scope: p.scope
            }));
    };

    const editor = useEditor({
        extensions: [
            StarterKit,
            TextStyle,
            FontSize,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Highlight,
            Underline,
            SmartTokenNode,
            SmartTokenAtSuggestion.configure({
                getTokens: getAtTokens
            }),
            SmartTokenSlashSuggestion.configure({
                getTokens: getSlashTokens
            }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: initialContent,
        editable: !disabled,
        onUpdate: ({ editor }) => {
            // Re-serialize strictly without HTML pill spans, converting them back to raw `{{target}}`
            const rawHtml = editor.getHTML();
            const persistentString = serializeTokensToDB(rawHtml);
            onChange(persistentString);
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm prose-slate max-w-none focus:outline-none min-h-[16rem] p-4 text-slate-800 prose-table:border prose-table:border-slate-300 prose-th:border prose-th:bg-slate-100 prose-th:p-2 prose-td:border prose-td:p-2 prose-td:relative',
            },
        },
    });

    // Handle incoming value updates from parent nicely without losing cursor
    useEffect(() => {
        if (editor && value !== undefined) {
            const currentSerialized = serializeTokensToDB(editor.getHTML());
            // Only update content if incoming value differs from what TipTap currently holds
            if (currentSerialized !== value) {
                const parsed = deserializeTokensFromDB(value || '<p></p>');
                // TipTap update without blowing away the history gracefully
                editor.commands.setContent(parsed, { emitUpdate: false });
            }
        }
    }, [value, editor]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(!disabled);
        }
    }, [disabled, editor]);

    return (
        <div className={`flex flex-col border border-slate-300 rounded-lg overflow-hidden bg-white transition-all ${disabled ? 'opacity-80' : 'focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10'}`}>
            <style>{`
                .editor-container .selectedCell:after {
                    z-index: 2;
                    position: absolute;
                    content: "";
                    left: 0; right: 0; top: 0; bottom: 0;
                    background: rgba(167, 243, 208, 0.4);
                    pointer-events: none;
                }
                .editor-container .column-resize-handle {
                    position: absolute;
                    right: -2px;
                    top: 0;
                    bottom: -2px;
                    width: 4px;
                    background-color: #34d399;
                    pointer-events: none;
                }
            `}</style>
            <MenuBar editor={editor} />
            <div className={`overflow-y-auto max-h-[28rem] editor-container ${disabled ? 'bg-slate-50' : 'bg-white'}`}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};
