import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`message-enter flex gap-4 px-4 py-4 ${isUser ? '' : 'bg-[#0f0f1a]'}`}>
      {/* Avatar */}
      <div className="shrink-0">
        {isUser ? (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
            U
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-500 mb-1 font-medium">
          {isUser ? 'Você' : 'Z Agent'}
        </div>
        <div className={`markdown-body ${isError ? 'text-red-400' : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Action results */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.actions.map((action, i) => (
              <ActionResult key={i} action={action} />
            ))}
          </div>
        )}

        {/* Screenshots in message */}
        {message.screenshot && (
          <div className="mt-2">
            <img
              src={`data:${message.screenshot.mimeType};base64,${message.screenshot.base64}`}
              alt="Screenshot"
              className="screenshot-preview"
              onClick={() => {
                // Open in default viewer
                const w = window.open('');
                w.document.write(`<img src="data:${message.screenshot.mimeType};base64,${message.screenshot.base64}" style="max-width:100%;height:auto"/>`);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionResult({ action }) {
  const [expanded, setExpanded] = useState(false);

  const getActionLabel = (type) => {
    const labels = {
      execute_command: 'Comando executado',
      screenshot: 'Screenshot capturado',
      mouse_click: 'Clique do mouse',
      mouse_move: 'Movimento do mouse',
      type_text: 'Texto digitado',
      press_key: 'Tecla pressionada',
      open_app: 'Aplicativo aberto',
      open_url: 'URL aberta',
      scroll: 'Scroll executado',
      list_processes: 'Processos listados',
    };
    return labels[type] || type;
  };

  const getActionIcon = (type) => {
    const icons = {
      execute_command: '💻',
      screenshot: '📸',
      mouse_click: '🖱️',
      mouse_move: '↗️',
      type_text: '⌨️',
      press_key: '🔑',
      open_app: '📂',
      open_url: '🌐',
      scroll: '📜',
      list_processes: '📊',
    };
    return icons[type] || '⚡';
  };

  return (
    <div className="action-result">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{getActionIcon(action.type)}</span>
        <span className="action-label">{getActionLabel(action.type)}</span>
        <span className="text-zinc-600 text-xs ml-auto">
          {action.success === false ? '❌' : action.success === true ? '✅' : ''}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {expanded && (
        <div className="mt-2">
          {action.type === 'execute_command' && (
            <div>
              <div className="text-xs text-indigo-400 mb-1">Comando:</div>
              <code className="text-xs bg-black/30 px-2 py-1 rounded block">{action.command}</code>
              {action.stdout && (
                <div className="mt-2">
                  <div className="text-xs text-emerald-400 mb-1">Saída:</div>
                  <pre className="action-output bg-black/30 p-2 rounded text-xs">{action.stdout}</pre>
                </div>
              )}
              {action.stderr && (
                <div className="mt-2">
                  <div className="text-xs text-red-400 mb-1">Erro:</div>
                  <pre className="action-output bg-black/30 p-2 rounded text-xs text-red-300">{action.stderr}</pre>
                </div>
              )}
            </div>
          )}
          {action.type === 'screenshot' && action.base64 && (
            <img
              src={`data:image/png;base64,${action.base64}`}
              alt="Screenshot"
              className="screenshot-preview mt-1"
            />
          )}
          {(action.type === 'mouse_click' || action.type === 'mouse_move') && (
            <div className="text-xs text-zinc-400">
              Coordenadas: ({action.x}, {action.y}) {action.button ? `| Botão: ${action.button}` : ''}
            </div>
          )}
          {action.type === 'type_text' && (
            <div className="text-xs text-zinc-400">
              Texto: "{action.text}"
            </div>
          )}
          {action.type === 'open_app' && (
            <div className="text-xs text-zinc-400">
              Aplicativo: {action.name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-4 px-4 py-4 bg-[#0f0f1a]">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <div className="flex items-center gap-1 pt-2">
        <div className="w-2 h-2 rounded-full bg-indigo-400 typing-dot" />
        <div className="w-2 h-2 rounded-full bg-indigo-400 typing-dot" />
        <div className="w-2 h-2 rounded-full bg-indigo-400 typing-dot" />
      </div>
    </div>
  );
}

export default function ChatArea({ messages, isLoading, onSendMessage, onNewChat }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat header */}
      <div className="h-12 border-b border-zinc-800/30 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-glow" />
          <span className="text-sm text-zinc-400">Z Desktop Agent</span>
        </div>
        <button
          onClick={onNewChat}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova conversa
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-800/30 p-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative flex items-end bg-[#1a1a28] rounded-xl border border-zinc-800/50 focus-within:border-indigo-500/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Peça para a IA controlar seu computador..."
              rows={1}
              className="flex-1 bg-transparent text-zinc-200 placeholder-zinc-600 px-4 py-3.5 resize-none outline-none text-sm max-h-[200px]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="shrink-0 m-2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-colors text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <div className="text-center mt-2 text-xs text-zinc-700">
            A IA pode executar ações no seu computador. Use com cuidado.
          </div>
        </form>
      </div>
    </div>
  );
}
