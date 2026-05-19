import React from 'react';

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
  onClose,
}) {
  const formatDate = (timestamp) => {
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return 'Hoje';
    if (diff < 172800000) return 'Ontem';
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} dias atrás`;
    return d.toLocaleDateString('pt-BR');
  };

  let lastDate = '';

  return (
    <div className="w-64 bg-[#0a0a12] border-r border-zinc-800/50 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-zinc-800/30">
        <button
          onClick={onNew}
          className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-zinc-700/50 hover:bg-zinc-800/50 transition-colors text-sm text-zinc-300"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova conversa
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">
            Nenhuma conversa ainda
          </div>
        ) : (
          conversations.map((conv) => {
            const dateStr = formatDate(conv.updatedAt);
            const showDate = dateStr !== lastDate;
            lastDate = dateStr;

            return (
              <div key={conv.id}>
                {showDate && (
                  <div className="px-4 py-2 text-xs text-zinc-600 font-medium uppercase tracking-wider">
                    {dateStr}
                  </div>
                )}
                <div
                  onClick={() => onSelect(conv.id)}
                  className={`group mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm ${
                    activeId === conv.id
                      ? 'bg-[#1e2a4a] text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all ml-2 shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800/30">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors text-sm text-zinc-400 hover:text-zinc-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Configurações
        </button>
      </div>
    </div>
  );
}
