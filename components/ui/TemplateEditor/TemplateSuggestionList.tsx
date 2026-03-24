import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface TemplateToken {
  id: string;
  trigger: string;
  label: string;
  description?: string;
}

interface SuggestionListProps {
  items: TemplateToken[];
  command: (item: TemplateToken) => void;
}

export const TemplateSuggestionList = forwardRef((props: SuggestionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const selectedIndexRef = React.useRef(selectedIndex);
  useEffect(() => {
      selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
      setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((selectedIndexRef.current + props.items.length - 1) % props.items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((selectedIndexRef.current + 1) % props.items.length);
        return true;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const item = props.items[selectedIndexRef.current];
        if (item) {
          props.command(item);
        }
        return true;
      }

      return false;
    },
  }), [props.items, props.command]);

  if (!props.items || props.items.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden flex flex-col py-1" style={{ width: '280px', maxHeight: '300px' }}>
      <div className="text-xs font-semibold text-gray-400 px-3 py-1 uppercase tracking-wider">
        Tokens
      </div>
      <div className="overflow-y-auto px-1.5 pb-1 max-h-64">
        {props.items.map((item, index) => (
          <button
            className={`w-full text-left px-3 py-2 flex flex-col focus:outline-none rounded-md transition-colors mb-0.5 ${
              index === selectedIndex 
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-sm outline-none' 
                : 'text-gray-900 hover:bg-gray-50 border border-transparent outline-none'
            }`}
            key={item.id}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="font-semibold text-sm truncate">@{item.trigger}</span>
            <span className={`text-xs truncate ${index === selectedIndex ? 'text-emerald-700' : 'text-gray-500'}`}>
                {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});
