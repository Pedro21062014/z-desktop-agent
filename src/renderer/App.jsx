import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import TitleBar from './components/TitleBar';
import WelcomeScreen from './components/WelcomeScreen';
import { GeminiClient } from './utils/geminiClient';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const [settings, setSettings] = useState({ apiKey: '', model: 'gemini-2.0-flash', theme: 'dark' });
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [geminiClient, setGeminiClient] = useState(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadConversations();
  }, []);

  // Initialize Gemini client when settings change
  useEffect(() => {
    if (settings.apiKey) {
      setGeminiClient(new GeminiClient(settings.apiKey, settings.model));
    } else {
      setGeminiClient(null);
    }
  }, [settings.apiKey, settings.model]);

  const loadSettings = async () => {
    try {
      const s = await window.electronAPI.getSettings();
      setSettings(s);
      if (!s.apiKey) setShowSettings(true);
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  };

  const loadConversations = async () => {
    try {
      const convs = await window.electronAPI.listConversations();
      setConversations(convs);
    } catch (e) {
      console.error('Error loading conversations:', e);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    await window.electronAPI.saveSettings(newSettings);
    setSettings(newSettings);
    setShowSettings(false);
  };

  const createNewConversation = () => {
    const id = uuidv4();
    const newConv = {
      id,
      title: 'Nova conversa',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setActiveConvId(id);
    setMessages([]);
    window.electronAPI.saveConversation(newConv);
    loadConversations();
  };

  const selectConversation = async (id) => {
    try {
      const conv = await window.electronAPI.loadConversation(id);
      if (conv) {
        setActiveConvId(id);
        setMessages(conv.messages || []);
      }
    } catch (e) {
      console.error('Error loading conversation:', e);
    }
  };

  const deleteConversation = async (id) => {
    await window.electronAPI.deleteConversation(id);
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
    loadConversations();
  };

  const saveCurrentConversation = useCallback(async (msgs, convId = activeConvId) => {
    if (!convId || msgs.length === 0) return;
    const title = msgs[0]?.content?.substring(0, 50) || 'Nova conversa';
    const conv = {
      id: convId,
      title,
      messages: msgs,
      updatedAt: Date.now(),
    };
    await window.electronAPI.saveConversation(conv);
    loadConversations();
  }, [activeConvId]);

  const sendMessage = async (content) => {
    if (!settings.apiKey) {
      setShowSettings(true);
      return;
    }

    let convId = activeConvId;
    if (!convId) {
      convId = uuidv4();
      setActiveConvId(convId);
    }

    const userMessage = { role: 'user', content, timestamp: Date.now() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      if (!geminiClient) {
        throw new Error('API Key não configurada. Abra as configurações.');
      }

      // Build conversation history for Gemini
      const history = newMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      // Chat is now handled entirely by the main process via IPC
      // Desktop automation functions are executed during the chat loop in main process
      const response = await geminiClient.chat(history);
      
      const assistantMessage = { 
        role: 'assistant', 
        content: response.text, 
        timestamp: Date.now(),
        actions: response.actions || [],
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      saveCurrentConversation(updatedMessages, convId);
    } catch (e) {
      const errorMessage = {
        role: 'assistant',
        content: `Erro: ${e.message}`,
        timestamp: Date.now(),
        isError: true,
      };
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      saveCurrentConversation(updatedMessages, convId);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <TitleBar onToggleSidebar={() => setShowSidebar(!showSidebar)} />
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <Sidebar
            conversations={conversations}
            activeId={activeConvId}
            onSelect={selectConversation}
            onNew={createNewConversation}
            onDelete={deleteConversation}
            onOpenSettings={() => setShowSettings(true)}
            onClose={() => setShowSidebar(false)}
          />
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 && !activeConvId ? (
            <WelcomeScreen onSendMessage={sendMessage} onOpenSettings={() => setShowSettings(true)} hasApiKey={!!settings.apiKey} />
          ) : (
            <ChatArea
              messages={messages}
              isLoading={isLoading}
              onSendMessage={sendMessage}
              onNewChat={createNewConversation}
            />
          )}
        </div>
      </div>
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
