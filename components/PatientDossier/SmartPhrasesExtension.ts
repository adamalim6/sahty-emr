import { Extension, Node } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance, GetReferenceClientRect } from 'tippy.js';
import { PluginKey } from '@tiptap/pm/state';
import { SmartPhrase } from '../../hooks/useSmartPhrases';
import { SuggestionList } from './SuggestionList';

export const SmartPhraseCursor = Node.create({
  name: 'smartPhraseCursor',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  parseHTML() {
    return [
      {
        tag: 'span[data-smartphrase-cursor]',
      },
    ]
  },

  renderHTML: () => {
    return ['span', { 'data-smartphrase-cursor': 'true' }]
  },
})

export const SmartPhrasesExtension = Extension.create({
  name: 'smartPhrases',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        pluginKey: new PluginKey('smartPhrases'),
        command: ({ editor, range, props }: any) => {
          const phrase = props as SmartPhrase;
          
          // 1. Replace the marker in the payload
          const html = phrase.body_html.replace('{{cursor}}', '<span data-smartphrase-cursor="true"></span>');

          // 2. Insert the HTML, replacing the trigger command
          editor.chain()
            .focus()
            .deleteRange(range)
            .insertContent(html)
            .run();

          // 3. Locate the cursor marker node and fix the selection natively
          let cursorPosition = -1;
          const { state } = editor;

          state.doc.descendants((node, pos) => {
            if (node.type.name === 'smartPhraseCursor') {
              cursorPosition = pos;
              return false; // Stop traversing
            }
            return true;
          });

          if (cursorPosition !== -1) {
             editor.chain()
                .focus()
                .deleteRange({ from: cursorPosition, to: cursorPosition + 1 })
                .setTextSelection(cursorPosition)
                .run();
          }
        },
      },
      getPhrases: () => [] as SmartPhrase[],
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => {
            const currentPhrases = this.options.getPhrases();
            console.log('Slash query:', query, 'Available phrases:', currentPhrases.length);
            
            // Require at least one character typed after the slash
            if (!query || query.length === 0) {
                return [];
            }
            
            // Normalize exactly as requested
            const normalizedInput = query.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // Filter phrases natively
            const matched = currentPhrases.filter(phrase => 
                phrase.trigger_search.startsWith(normalizedInput)
            );

            // Limit suggestion results to a maximum of 20 items
            return matched.slice(0, 20);
        },
        render: () => {
          let reactRenderer: ReactRenderer<any>;
          let popup: TippyInstance[];

          return {
            onStart: (props) => {
              reactRenderer = new ReactRenderer(SuggestionList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) {
                  return;
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as GetReferenceClientRect,
                appendTo: () => document.body,
                content: reactRenderer.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },

            onUpdate(props) {
              if (!reactRenderer || !popup?.[0]) {
                  return;
              }

              reactRenderer.updateProps(props);

              if (!props.clientRect) {
                  return;
              }

              popup[0].setProps({
                  getReferenceClientRect: props.clientRect as GetReferenceClientRect,
              });
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }

              return reactRenderer?.ref?.onKeyDown(props) || false;
            },

            onExit() {
              if (popup?.[0]) {
                  popup[0].destroy();
              }
              if (reactRenderer) {
                  reactRenderer.destroy();
              }
            },
          };
        },
      }),
    ];
  },
});
