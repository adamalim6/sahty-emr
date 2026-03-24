import { Node, mergeAttributes } from '@tiptap/core';

export const SmartTokenNode = Node.create({
  name: 'smartToken',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true, // Acts as a single impenetrable block

  addAttributes() {
    return {
      tokenId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-smart-token]',
        getAttrs: (node) => {
          if (node instanceof HTMLElement) {
            return {
              tokenId: node.getAttribute('data-token-id'),
            };
          }
          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const tokenId = HTMLAttributes.tokenId as string;
    
    let colorClasses = 'bg-emerald-100 text-emerald-800 border border-emerald-200'; // Smart values
    if (tokenId === 'cursor') {
        colorClasses = 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    } else if (!['vitals', 'allergies', 'addictions'].includes(tokenId)) {
        colorClasses = 'bg-purple-100 text-purple-800 border border-purple-200'; // Smart phrases
    }

    // Render an uneditable pill returning the visual representation
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-smart-token': 'true',
        'data-token-id': tokenId,
        class: `inline-flex items-center px-2 py-0.5 mx-0.5 rounded text-xs font-bold leading-none select-none cursor-default ${colorClasses}`,
        contenteditable: 'false'
      }),
      `{{${tokenId}}}`
    ];
  }
});

// Helper functions for preprocessing and serialization against the DB
export const serializeTokensToDB = (html: string) => {
    // Replaces the entire HTML span block with purely {{tokenId}}
    const pattern = /<span[^>]*data-smart-token="true"[^>]*data-token-id="([^"]+)"[^>]*>.*?<\/span>/g;
    return html.replace(pattern, '{{$1}}');
};

export const deserializeTokensFromDB = (html: string) => {
    // Converts canonical {{tokenId}} cleanly into TipTap parsable span tags
    const pattern = /\{\{([^}]+)\}\}/g;
    return html.replace(pattern, (match, tokenId) => {
        return `<span data-smart-token="true" data-token-id="${tokenId}">{{${tokenId}}}</span>`;
    });
};
