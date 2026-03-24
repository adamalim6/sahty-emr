import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance, GetReferenceClientRect } from 'tippy.js';
import { PluginKey } from '@tiptap/pm/state';
import { TemplateSuggestionList, TemplateToken } from './TemplateSuggestionList';

const getSuggestionRender = () => {
  let reactRenderer: ReactRenderer<any>;
  let popup: TippyInstance[];

  return {
    onStart: (props: any) => {
      reactRenderer = new ReactRenderer(TemplateSuggestionList, {
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

const createSmartTokenSuggestion = (name: string, char: string, pluginKeyName: string) => Extension.create({
  name,

  addOptions() {
    return {
      getTokens: () => [] as TemplateToken[],
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char,
        startOfLine: false,
        pluginKey: new PluginKey(pluginKeyName),
        allow: ({ range }) => (range.to - range.from) > 1,
        command: ({ editor, range, props }: any) => {
            const token = props as TemplateToken;
            
            if (token.id === 'cursor') {
                import('react-hot-toast').then(({ default: toast }) => {
                    let hasCursor = false;
                    editor.state.doc.descendants((node: any) => {
                        if (node.type.name === 'smartToken' && node.attrs.tokenId === 'cursor') {
                            hasCursor = true;
                        }
                    });
                    if (hasCursor) {
                        toast.error('Un seul curseur est autorisé par template');
                        // Always delete the trigger to clean up even if rejected
                        editor.chain().focus().deleteRange(range).run();
                        return;
                    }
                    
                    editor.chain()
                      .focus()
                      .deleteRange(range)
                      .insertContent({ type: 'smartToken', attrs: { tokenId: token.id } })
                      .run();
                });
                return;
            }

            // Insert symbolic SmartTokenNode
            editor.chain()
              .focus()
              .deleteRange(range)
              .insertContent({ type: 'smartToken', attrs: { tokenId: token.id } })
              .run();
        },
        items: ({ query }) => {
            const currentTokens = this.options.getTokens();
            if (!query || query.length === 0) return [];
            const normalizedInput = query.toLowerCase().replace(/[^a-z0-9_-]/g, '');
            const matched = currentTokens.filter(val => 
                val.trigger.toLowerCase().startsWith(normalizedInput)
            );
            return matched.slice(0, 20);
        },
        render: getSuggestionRender,
      }),
    ];
  },
});

export const SmartTokenAtSuggestion = createSmartTokenSuggestion('smartTokenAtSuggestion', '@', 'templateAtSuggestion');
export const SmartTokenSlashSuggestion = createSmartTokenSuggestion('smartTokenSlashSuggestion', '/', 'templateSlashSuggestion');
