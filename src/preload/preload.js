const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Conversations
  listConversations: () => ipcRenderer.invoke('list-conversations'),
  loadConversation: (id) => ipcRenderer.invoke('load-conversation', id),
  saveConversation: (conv) => ipcRenderer.invoke('save-conversation', conv),
  deleteConversation: (id) => ipcRenderer.invoke('delete-conversation', id),

  // Desktop Automation
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  executeCommand: (cmd, timeout) => ipcRenderer.invoke('execute-command', cmd, timeout),
  mouseClick: (x, y, button, double) => ipcRenderer.invoke('mouse-click', x, y, button, double),
  mouseMove: (x, y) => ipcRenderer.invoke('mouse-move', x, y),
  typeText: (text) => ipcRenderer.invoke('type-text', text),
  pressKey: (key, modifiers) => ipcRenderer.invoke('press-key', key, modifiers),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  openApp: (name) => ipcRenderer.invoke('open-app', name),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  mouseScroll: (amount, dir) => ipcRenderer.invoke('mouse-scroll', amount, dir),
  getMousePos: () => ipcRenderer.invoke('get-mouse-pos'),
  listProcesses: () => ipcRenderer.invoke('list-processes'),

  // Window management
  windowAction: (action) => ipcRenderer.invoke('window-action', action),
  windowDragStart: (pos) => ipcRenderer.invoke('window-drag-start', pos),
  windowDragMove: (pos) => ipcRenderer.invoke('window-drag-move', pos),
});
