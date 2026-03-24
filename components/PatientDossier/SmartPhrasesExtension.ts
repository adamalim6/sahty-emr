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

const getSuggestionRender = () => {
  let reactRenderer: ReactRenderer<any>;
  let popup: TippyInstance[];

  return {
    onStart: (props: any) => {
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

    onUpdate(props: any) {
      if (!reactRenderer || !popup?.[0]) return;
      reactRenderer.updateProps(props);
      if (!props.clientRect) return;
      popup[0].setProps({
          getReferenceClientRect: props.clientRect as GetReferenceClientRect,
      });
    },

    onKeyDown(props: any) {
      if (props.event.key === 'Escape') {
        popup?.[0]?.hide();
        return true;
      }
      return reactRenderer?.ref?.onKeyDown(props) || false;
    },

    onExit() {
      if (popup?.[0]) popup[0].destroy();
      if (reactRenderer) reactRenderer.destroy();
    },
  };
};

export const SmartPhrasesExtension = Extension.create({
  name: 'smartPhrases',

  addOptions() {
    return {
      getPhrases: () => [] as SmartPhrase[],
      getValues: () => [] as SmartPhrase[],
      tenantPatientId: '' as string,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        pluginKey: new PluginKey('slashSuggestion'),
        allow: ({ range }) => (range.to - range.from) > 1,
        command: async ({ editor, range, props }: any) => {
          const phrase = props as SmartPhrase;
          
          // Smart Phrase execution (Hybrid)
          let finalHtml = phrase.body_html;
          const hasDynamicTokens = /{{(?!cursor).*?}}/.test(phrase.body_html);

          if (hasDynamicTokens) {
              const tenantPatientId = this.options.tenantPatientId;
              if (!tenantPatientId) {
                  import('react-hot-toast').then(({ default: toast }) => toast.error("ID patient manquant."));
                  return;
              }

              try {
                  const { api } = await import('../../services/api');
                  
                  const fetchPromise = api.compileSmartPhrase({
                      phraseId: phrase.id,
                      tenantPatientId
                  });
                  const timeoutPromise = new Promise<{html: string}>((_, reject) => 
                      setTimeout(() => reject(new Error('TIMEOUT')), 3000)
                  );

                  const response = await Promise.race([fetchPromise, timeoutPromise]);
                  finalHtml = response.html;
              } catch (err: any) {
                  const { default: toast } = await import('react-hot-toast');
                  if (err.message === 'TIMEOUT') {
                      toast.error(`Délai d'attente dépassé pour la compilation de /${phrase.trigger}`);
                  } else {
                      toast.error(`Impossible de compiler /${phrase.trigger}`);
                  }
                  return; // Abort insertion on compiler failure
              }
          }

          // Replace cursor token and insert fully compiled text
          finalHtml = finalHtml.replace('{{cursor}}', '<span data-smartphrase-cursor="true"></span>');

          editor.chain()
            .focus()
            .deleteRange(range)
            .insertContent(finalHtml)
            .run();

          let cursorPosition = -1;
          const { state } = editor;

          state.doc.descendants((node, pos) => {
            if (node.type.name === 'smartPhraseCursor') {
              cursorPosition = pos;
              return false;
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
        items: ({ query }) => {
            const currentPhrases = this.options.getPhrases();
            if (!query || query.length === 0) return [];
            const normalizedInput = query.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matched = currentPhrases.filter(phrase => 
                phrase.trigger_search.startsWith(normalizedInput)
            );
            return matched.slice(0, 20);
        },
        render: getSuggestionRender,
      }),

      Suggestion({
        editor: this.editor,
        char: '@',
        startOfLine: false,
        pluginKey: new PluginKey('atSuggestion'),
        allow: ({ range }) => (range.to - range.from) > 1,
        command: async ({ editor, range, props }: any) => {
            const phrase = props as SmartPhrase;
            const tenantPatientId = this.options.tenantPatientId;

            if (!tenantPatientId) {
                import('react-hot-toast').then(({ default: toast }) => toast.error("ID patient manquant."));
                return;
            }

            // Eagerly delete trigger text before async fetch
            editor.chain().focus().deleteRange(range).run();

            try {
                const { api } = await import('../../services/api');
                
                const fetchPromise = api.resolveSmartValue(phrase.trigger, tenantPatientId);
                const timeoutPromise = new Promise<{html: string}>((_, reject) => 
                    setTimeout(() => reject(new Error('TIMEOUT')), 3000)
                );

                const { html } = await Promise.race([fetchPromise, timeoutPromise]);
                
                editor.chain().focus().insertContent(html).run();

            } catch (err: any) {
                const { default: toast } = await import('react-hot-toast');
                if (err.message === 'TIMEOUT') {
                    toast.error(`Délai d'attente dépassé pour @${phrase.trigger}`);
                } else {
                    toast.error(`Impossible de charger les données pour @${phrase.trigger}`);
                }
            }
        },
        items: ({ query }) => {
            const currentValues = this.options.getValues();
            if (!query || query.length === 0) return [];
            const normalizedInput = query.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matched = currentValues.filter(val => 
                val.trigger_search.startsWith(normalizedInput)
            );
            return matched.slice(0, 20);
        },
        render: getSuggestionRender,
      }),
    ];
  },
});
