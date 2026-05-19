import React from 'react';

const SUGGESTIONS = [
  {
    icon: '📸',
    title: 'Tirar screenshot',
    description: 'Capturar a tela atual',
    prompt: 'Tire um screenshot da minha tela atual',
  },
  {
    icon: '💻',
    title: 'Executar comando',
    description: 'Rodar um comando no terminal',
    prompt: 'Execute o comando "ls -la" no terminal',
  },
  {
    icon: '📂',
    title: 'Abrir aplicativo',
    description: 'Iniciar um programa',
    prompt: 'Abra o navegador Firefox',
  },
  {
    icon: '🖱️',
    title: 'Clicar na tela',
    description: 'Automatizar cliques',
    prompt: 'Tire um screenshot e clique no ícone do navegador na área de trabalho',
  },
];

export default function WelcomeScreen({ onSendMessage, onOpenSettings, hasApiKey }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center">
        {/* Logo */}
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-zinc-100 mb-2">
          Z Desktop Agent
        </h1>
        <p className="text-zinc-500 mb-8 text-lg">
          Seu assistente de IA com controle total do computador
        </p>

        {!hasApiKey && (
          <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-amber-400 text-sm">
              Configure sua API Key do Google para começar
            </p>
            <button
              onClick={onOpenSettings}
              className="mt-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-300 text-sm transition-colors"
            >
              Configurar API Key
            </button>
          </div>
        )}

        {/* Suggestion cards */}
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => onSendMessage(s.prompt)}
              disabled={!hasApiKey}
              className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-zinc-700/50 transition-all text-left group disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                {s.title}
              </div>
              <div className="text-xs text-zinc-600 mt-1">{s.description}</div>
            </button>
          ))}
        </div>

        {/* Features */}
        <div className="mt-12 flex items-center justify-center gap-6 text-xs text-zinc-600">
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Seguro e local
          </span>
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Controle total
          </span>
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
            Multi-plataforma
          </span>
        </div>
      </div>
    </div>
  );
}
