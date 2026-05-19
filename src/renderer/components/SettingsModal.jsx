import React, { useState, useEffect } from 'react';

// Default fallback models if API fetch fails
const FALLBACK_MODELS = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Rápido e eficiente' },
  { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', description: 'Equilíbrio entre velocidade e inteligência' },
  { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', description: 'Mais inteligente, tarefas complexas' },
];

export default function SettingsModal({ settings, onSave, onClose }) {
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [model, setModel] = useState(settings.model || 'gemini-2.0-flash');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState(null);

  // Fetch models from the API when the API key changes
  useEffect(() => {
    if (apiKey && apiKey.length > 10) {
      fetchModels(apiKey);
    } else {
      setModels(FALLBACK_MODELS);
      setModelsError(null);
    }
  }, [apiKey]);

  const fetchModels = async (key) => {
    setLoadingModels(true);
    setModelsError(null);
    try {
      const result = await window.electronAPI.listGeminiModels(key);
      if (result.success && result.models.length > 0) {
        setModels(result.models);
        // If current model is not in the list, select the first one
        if (!result.models.find(m => m.id === model)) {
          setModel(result.models[0].id);
        }
      } else {
        setModelsError(result.error || 'Nenhum modelo encontrado');
        setModels(FALLBACK_MODELS);
      }
    } catch (e) {
      setModelsError('Erro ao buscar modelos');
      setModels(FALLBACK_MODELS);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = () => {
    onSave({ ...settings, apiKey, model });
  };

  const handleTest = async () => {
    if (!apiKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.testApiConnection(apiKey, model);
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  const formatTokenLimit = (limit) => {
    if (!limit) return '';
    if (limit >= 1000000) return `${(limit / 1000000).toFixed(1)}M`;
    if (limit >= 1000) return `${(limit / 1000).toFixed(0)}K`;
    return limit.toString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-[#111118] border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
          <h2 className="text-lg font-semibold text-zinc-100">Configurações</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Chave de API do Google
            </label>
            <p className="text-xs text-zinc-500 mb-3">
              Obtenha sua chave em{' '}
              <span className="text-indigo-400">aistudio.google.com</span>
            </p>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-[#0d0d14] border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showKey ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-300">
                Modelo de IA
              </label>
              {apiKey && (
                <button
                  onClick={() => fetchModels(apiKey)}
                  disabled={loadingModels}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {loadingModels ? (
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                  )}
                  {loadingModels ? 'Buscando...' : 'Atualizar lista'}
                </button>
              )}
            </div>

            {modelsError && (
              <div className="mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                {modelsError} — usando lista padrão
              </div>
            )}

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    model === m.id
                      ? 'border-indigo-500/50 bg-indigo-500/10 text-zinc-100'
                      : 'border-zinc-800/50 bg-[#0d0d14] hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate mr-2">{m.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.inputTokenLimit && (
                        <span className="text-[10px] text-zinc-600 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                          {formatTokenLimit(m.inputTokenLimit)} tokens
                        </span>
                      )}
                      {model === m.id && (
                        <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-zinc-600 mt-0.5 block truncate">{m.description || m.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Test Connection */}
          {apiKey && (
            <div>
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {testing && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {testing ? 'Testando conexão...' : 'Testar conexão'}
              </button>
              {testResult && (
                <div className={`mt-2 p-3 rounded-lg text-sm ${
                  testResult.success 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {testResult.success ? testResult.message : testResult.error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
