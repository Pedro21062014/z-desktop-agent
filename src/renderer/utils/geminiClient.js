/**
 * GeminiClient - Google Gemini API integration via IPC (main process)
 * All API calls go through the main process to avoid CORS issues
 */

export class GeminiClient {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(history) {
    const result = await window.electronAPI.chatGemini(this.apiKey, this.model, history);

    if (!result.success) {
      throw new Error(result.error || 'Erro desconhecido na comunicação com a API');
    }

    return {
      text: result.text,
      actions: result.actions || [],
    };
  }
}
