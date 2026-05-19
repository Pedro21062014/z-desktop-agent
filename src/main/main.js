const { app, BrowserWindow, ipcMain, screen, desktopCapturer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const os = require('os');
const https = require('https');
const http = require('http');

// Native robotjs for desktop automation (optional - requires build tools)
let robot;
try {
  robot = require('robotjs');
} catch (e) {
  console.warn('robotjs not available. Install build tools for native module support.');
  console.warn('On Linux: sudo apt-get install build-essential libxtst-dev libx11-dev');
  console.warn('On Windows: npm install --global windows-build-tools');
  console.warn('Fallback: using xdotool (Linux) / PowerShell (Windows) for automation');
}

// Screenshot capture
let screenshot;
try {
  screenshot = require('screenshot-desktop');
} catch (e) {
  console.warn('screenshot-desktop not available:', e.message);
}

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const CONVERSATIONS_DIR = path.join(app.getPath('userData'), 'conversations');

// Ensure conversations directory exists
if (!fs.existsSync(CONVERSATIONS_DIR)) {
  fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}

let mainWindow;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, screenWidth),
    height: Math.min(900, screenHeight),
    minWidth: 900,
    minHeight: 600,
    title: 'Z Desktop Agent',
    backgroundColor: '#0d0d0d',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
  });

  // In development, load from webpack dev server
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

  if (isDev) {
    mainWindow.loadURL('http://localhost:9000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// =============================================
// Helper: Fallback automation using xdotool/PowerShell
// =============================================

async function fallbackMouseMove(x, y) {
  const platform = os.platform();
  if (platform === 'linux') {
    return new Promise((resolve) => {
      exec(`xdotool mousemove ${Math.round(x)} ${Math.round(y)}`, (error, stdout, stderr) => {
        resolve({ success: !error, error: error ? error.message : null });
      });
    });
  } else if (platform === 'win32') {
    return new Promise((resolve) => {
      const ps = `[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)},${Math.round(y)})`;
      exec(`powershell -command "${ps}"`, (error) => {
        resolve({ success: !error, error: error ? error.message : null });
      });
    });
  }
  return { success: false, error: 'No mouse automation available' };
}

async function fallbackMouseClick(x, y, button = 'left', doubleClick = false) {
  const platform = os.platform();
  if (platform === 'linux') {
    return new Promise((resolve) => {
      const btn = button === 'right' ? 3 : button === 'middle' ? 2 : 1;
      let cmd = `xdotool mousemove ${Math.round(x)} ${Math.round(y)} click ${btn}`;
      if (doubleClick) cmd = `xdotool mousemove ${Math.round(x)} ${Math.round(y)} click --repeat 2 ${btn}`;
      exec(cmd, (error) => {
        resolve({ success: !error, error: error ? error.message : null });
      });
    });
  } else if (platform === 'win32') {
    return new Promise((resolve) => {
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)},${Math.round(y)})
        Start-Sleep -Milliseconds 50
        ${button === 'right' ? 
          '$ws = New-Object System.Windows.Forms.SendKeys; [System.Windows.Forms.SendKeys]::SendWait("{RIGHTCLICK}")' : 
          `[System.Windows.Forms.SendKeys]::SendWait(${doubleClick ? '"{ENTER 2}"' : '"{ENTER}"'})`}
      `;
      exec(`powershell -command "${ps.replace(/\n/g, ' ')}"`, (error) => {
        resolve({ success: !error, error: error ? error.message : null });
      });
    });
  }
  return { success: false, error: 'No mouse automation available' };
}

async function fallbackTypeText(text) {
  const platform = os.platform();
  if (platform === 'linux') {
    return new Promise((resolve) => {
      exec(`xdotool type --delay 50 '${text.replace(/'/g, "'\\''")}'`, (error) => {
        resolve({ success: !error, error: error ? error.message : null });
      });
    });
  } else if (platform === 'win32') {
    return new Promise((resolve) => {
      const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${text.replace(/[{+^%~()]/g, '{$&')}')`;
      exec(`powershell -command "${ps}"`, (error) => {
        resolve({ success: !error, error: error ? error.message : null });
      });
    });
  }
  return { success: false, error: 'No keyboard automation available' };
}

async function fallbackPressKey(key, modifiers = []) {
  const platform = os.platform();
  if (platform === 'linux') {
    return new Promise((resolve) => {
      const modStr = modifiers.map(m => m === 'control' ? 'ctrl' : m === 'command' ? 'super' : m).join('+');
      const cmd = modStr ? `xdotool key ${modStr}+${key}` : `xdotool key ${key}`;
      exec(cmd, (error) => {
        resolve({ success: !error, error: error ? error.message : null });
      });
    });
  } else if (platform === 'win32') {
    return new Promise((resolve) => {
      const keyMap = { enter: '{ENTER}', tab: '{TAB}', escape: '{ESC}', backspace: '{BACKSPACE}', delete: '{DELETE}', up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}', space: ' ' };
      const mappedKey = keyMap[key.toLowerCase()] || key;
      const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${mappedKey}')`;
      exec(`powershell -command "${ps}"`, (error) => {
        resolve({ success: !error, error: error ? error.message : null });
      });
    });
  }
  return { success: false, error: 'No keyboard automation available' };
}

async function fallbackScroll(amount, direction = 'down') {
  const platform = os.platform();
  if (platform === 'linux') {
    return new Promise((resolve) => {
      const btn = direction === 'up' ? 4 : 5;
      const clicks = Math.abs(amount) || 3;
      let cmd = '';
      for (let i = 0; i < clicks; i++) cmd += `xdotool click ${btn} ; `;
      exec(cmd, (error) => {
        resolve({ success: !error, error: error ? error.message : null });
      });
    });
  }
  return { success: false, error: 'Scroll not available on this platform without robotjs' };
}

// =============================================
// IPC Handlers - Settings
// =============================================

ipcMain.handle('get-settings', async () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading settings:', e);
  }
  return { apiKey: '', model: 'gemini-2.0-flash', theme: 'dark' };
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// =============================================
// IPC Handlers - Conversations
// =============================================

ipcMain.handle('list-conversations', async () => {
  try {
    const files = fs.readdirSync(CONVERSATIONS_DIR).filter(f => f.endsWith('.json'));
    const conversations = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CONVERSATIONS_DIR, f), 'utf-8'));
        return { id: f.replace('.json', ''), title: data.title || 'Sem título', updatedAt: data.updatedAt || Date.now() };
      } catch {
        return null;
      }
    }).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
    return conversations;
  } catch (e) {
    return [];
  }
});

ipcMain.handle('load-conversation', async (event, id) => {
  try {
    const filePath = path.join(CONVERSATIONS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading conversation:', e);
  }
  return null;
});

ipcMain.handle('save-conversation', async (event, conversation) => {
  try {
    const filePath = path.join(CONVERSATIONS_DIR, `${conversation.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('delete-conversation', async (event, id) => {
  try {
    const filePath = path.join(CONVERSATIONS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// =============================================
// IPC Handlers - Desktop Automation
// =============================================

// Take screenshot
ipcMain.handle('take-screenshot', async () => {
  try {
    let imgPath;
    const platform = os.platform();

    if (screenshot) {
      const tmpDir = os.tmpdir();
      imgPath = path.join(tmpDir, `z-agent-screenshot-${Date.now()}.png`);
      await screenshot({ filename: imgPath });
    } else if (platform === 'linux') {
      // Fallback: use scrot or gnome-screenshot or import (ImageMagick)
      const tmpDir = os.tmpdir();
      imgPath = path.join(tmpDir, `z-agent-screenshot-${Date.now()}.png`);
      try {
        execSync(`import -window root "${imgPath}"`, { timeout: 10000 });
      } catch {
        try {
          execSync(`scrot "${imgPath}"`, { timeout: 10000 });
        } catch {
          try {
            execSync(`gnome-screenshot -f "${imgPath}"`, { timeout: 10000 });
          } catch {
            // Final fallback: electron desktopCapturer
            const sources = await desktopCapturer.getSources({
              types: ['screen'],
              thumbnailSize: { width: 1920, height: 1080 }
            });
            if (sources.length > 0) {
              const pngBuffer = sources[0].thumbnail.toPNG();
              fs.writeFileSync(imgPath, pngBuffer);
            }
          }
        }
      }
    } else if (platform === 'win32') {
      // Windows: use PowerShell screenshot
      const tmpDir = os.tmpdir();
      imgPath = path.join(tmpDir, `z-agent-screenshot-${Date.now()}.png`);
      try {
        const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $bmp = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); $bmp.Save('${imgPath.replace(/\\/g, '\\\\')}'); $g.Dispose(); $bmp.Dispose() }`;
        execSync(`powershell -command "${ps}"`, { timeout: 15000 });
      } catch {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 }
        });
        if (sources.length > 0) {
          const pngBuffer = sources[0].thumbnail.toPNG();
          fs.writeFileSync(imgPath, pngBuffer);
        }
      }
    } else {
      // Fallback using electron desktopCapturer
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });
      if (sources.length > 0) {
        const thumbnail = sources[0].thumbnail;
        const pngBuffer = thumbnail.toPNG();
        imgPath = path.join(os.tmpdir(), `z-agent-screenshot-${Date.now()}.png`);
        fs.writeFileSync(imgPath, pngBuffer);
      } else {
        return { success: false, error: 'No screen source found' };
      }
    }

    if (imgPath && fs.existsSync(imgPath)) {
      const imageData = fs.readFileSync(imgPath);
      const base64 = imageData.toString('base64');
      // Clean up temp file
      try { fs.unlinkSync(imgPath); } catch {}
      return { success: true, base64, mimeType: 'image/png' };
    }

    return { success: false, error: 'Failed to capture screenshot' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Execute command
ipcMain.handle('execute-command', async (event, command, timeout = 30000) => {
  return new Promise((resolve) => {
    exec(command, { timeout, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: error ? error.code : 0,
        error: error ? error.message : null,
      });
    });
  });
});

// Click at coordinates
ipcMain.handle('mouse-click', async (event, x, y, button = 'left', doubleClick = false) => {
  try {
    if (robot) {
      robot.moveMouse(Math.round(x), Math.round(y));
      if (doubleClick) {
        robot.mouseClick(button, true);
      } else {
        robot.mouseClick(button, false);
      }
      return { success: true };
    }
    // Fallback
    return await fallbackMouseClick(x, y, button, doubleClick);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Move mouse
ipcMain.handle('mouse-move', async (event, x, y) => {
  try {
    if (robot) {
      robot.moveMouse(Math.round(x), Math.round(y));
      return { success: true };
    }
    return await fallbackMouseMove(x, y);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Type text
ipcMain.handle('type-text', async (event, text) => {
  try {
    if (robot) {
      robot.typeString(text);
      return { success: true };
    }
    return await fallbackTypeText(text);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Press key
ipcMain.handle('press-key', async (event, key, modifiers = []) => {
  try {
    if (robot) {
      robot.keyTap(key, modifiers);
      return { success: true };
    }
    return await fallbackPressKey(key, modifiers);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Get screen size
ipcMain.handle('get-screen-size', async () => {
  try {
    if (robot) {
      const size = robot.getScreenSize();
      return { success: true, width: size.width, height: size.height };
    }
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    return { success: true, width, height };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Open application
ipcMain.handle('open-app', async (event, appName) => {
  try {
    const platform = os.platform();
    let command;

    if (platform === 'win32') {
      command = `start "" "${appName}"`;
    } else if (platform === 'linux') {
      command = `sh -c "which ${appName} >/dev/null 2>&1 && ${appName} & || xdg-open '${appName}'"`;
    } else {
      command = `open "${appName}"`;
    }

    exec(command, (error) => {
      if (error) {
        console.error('Error opening app:', error);
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Open URL
ipcMain.handle('open-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Scroll
ipcMain.handle('mouse-scroll', async (event, amount, direction = 'down') => {
  try {
    if (robot) {
      const scrollAmount = direction === 'up' ? -Math.abs(amount) : Math.abs(amount);
      robot.scrollMouse(0, scrollAmount);
      return { success: true };
    }
    return await fallbackScroll(amount, direction);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Get mouse position
ipcMain.handle('get-mouse-pos', async () => {
  try {
    if (robot) {
      const pos = robot.getMousePos();
      return { success: true, x: pos.x, y: pos.y };
    }
    const platform = os.platform();
    if (platform === 'linux') {
      const output = execSync('xdotool getmouselocation --shell', { timeout: 5000 }).toString();
      const matchX = output.match(/X=(\d+)/);
      const matchY = output.match(/Y=(\d+)/);
      if (matchX && matchY) {
        return { success: true, x: parseInt(matchX[1]), y: parseInt(matchY[1]) };
      }
    }
    return { success: false, error: 'Cannot determine mouse position' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Window management - minimize, maximize, close
ipcMain.handle('window-action', async (event, action) => {
  try {
    if (!mainWindow) return { success: false, error: 'No window' };
    switch (action) {
      case 'minimize': mainWindow.minimize(); break;
      case 'maximize': mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); break;
      case 'close': mainWindow.close(); break;
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Drag window
let dragOffset = { x: 0, y: 0 };
ipcMain.handle('window-drag-start', async (event, { x, y }) => {
  try {
    if (!mainWindow) return { success: false };
    const bounds = mainWindow.getBounds();
    dragOffset = { x: x - bounds.x, y: y - bounds.y };
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('window-drag-move', async (event, { x, y }) => {
  try {
    if (!mainWindow) return { success: false };
    mainWindow.setPosition(Math.round(x - dragOffset.x), Math.round(y - dragOffset.y));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// List running processes
ipcMain.handle('list-processes', async () => {
  try {
    const platform = os.platform();
    let command;
    if (platform === 'win32') {
      command = 'tasklist /FO CSV /NH';
    } else {
      command = 'ps aux --sort=-%mem | head -30';
    }
    const output = execSync(command, { timeout: 5000 }).toString();
    return { success: true, output, platform };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// =============================================
// IPC Handlers - Google Gemini API
// =============================================

// Helper: Make HTTP/HTTPS request
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// List available Gemini models from the API
ipcMain.handle('list-gemini-models', async (event, apiKey) => {
  try {
    if (!apiKey) {
      return { success: false, error: 'API Key não fornecida' };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await makeRequest(url);

    if (response.status !== 200) {
      const errorMsg = response.data?.error?.message || `Erro ${response.status}`;
      return { success: false, error: errorMsg };
    }

    const models = (response.data?.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name,
        description: m.description || '',
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
      }))
      .sort((a, b) => {
        // Sort: prefer newer models first, flash before pro
        const aName = a.id.toLowerCase();
        const bName = b.id.toLowerCase();
        // Prioritize models with "gemini" in the name
        if (aName.includes('gemini') && !bName.includes('gemini')) return -1;
        if (!aName.includes('gemini') && bName.includes('gemini')) return 1;
        // Then by version (2.5 > 2.0 > 1.5)
        return bName.localeCompare(aName);
      });

    return { success: true, models };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Test API Key connection
ipcMain.handle('test-api-connection', async (event, apiKey, model) => {
  try {
    if (!apiKey) {
      return { success: false, error: 'API Key não fornecida' };
    }

    const modelId = model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const body = JSON.stringify({
      contents: [{
        parts: [{ text: 'Responda apenas: OK' }]
      }],
      generationConfig: {
        maxOutputTokens: 10,
      }
    });

    const response = await makeRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (response.status === 200) {
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Conexão OK';
      return { success: true, message: `Conexão bem-sucedida! Modelo: ${modelId}` };
    }

    const errorMsg = response.data?.error?.message || `Erro ${response.status}`;
    const errorStatus = response.data?.error?.status || '';
    
    if (errorStatus === 'INVALID_ARGUMENT' || response.status === 400) {
      return { success: false, error: `Modelo "${modelId}" não disponível para esta API Key. Tente outro modelo.` };
    }
    if (response.status === 403 || errorStatus === 'PERMISSION_DENIED') {
      return { success: false, error: 'API Key não tem permissão. Verifique se a API Generative Language está habilitada.' };
    }
    if (response.status === 401) {
      return { success: false, error: 'API Key inválida ou expirada. Gere uma nova chave em aistudio.google.com' };
    }

    return { success: false, error: errorMsg };
  } catch (e) {
    return { success: false, error: `Erro de conexão: ${e.message}` };
  }
});

// =============================================
// IPC Handler - Chat with Gemini (main process, avoids CORS)
// =============================================

const DESKTOP_FUNCTIONS = [
  {
    name: 'execute_command',
    description: 'Executa um comando no terminal/prompt do sistema operacional. Pode rodar qualquer comando como ls, dir, pwd, echo, scripts, etc. Use para tarefas como listar arquivos, criar diretórios, instalar pacotes, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: { type: 'STRING', description: 'O comando para executar. Exemplos: "ls -la", "dir", "echo Olá", "mkdir nova_pasta"' },
        timeout: { type: 'NUMBER', description: 'Tempo limite em milissegundos (padrão: 30000)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'take_screenshot',
    description: 'Captura um screenshot da tela atual do computador. Útil para ver o que está na tela, verificar o estado de janelas, ler textos, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        description: { type: 'STRING', description: 'Motivo do screenshot ou o que procurar' },
      },
    },
  },
  {
    name: 'mouse_click',
    description: 'Clica em uma posição específica da tela. As coordenadas (x, y) são em pixels a partir do canto superior esquerdo. Use take_screenshot primeiro para ver a tela e determinar as coordenadas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: { type: 'NUMBER', description: 'Coordenada X em pixels (horizontal, da esquerda para direita)' },
        y: { type: 'NUMBER', description: 'Coordenada Y em pixels (vertical, de cima para baixo)' },
        button: { type: 'STRING', description: 'Botão do mouse: "left", "right", "middle"', enum: ['left', 'right', 'middle'] },
        doubleClick: { type: 'BOOLEAN', description: 'Se deve dar duplo clique' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'mouse_move',
    description: 'Move o cursor do mouse para uma posição específica da tela sem clicar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: { type: 'NUMBER', description: 'Coordenada X em pixels' },
        y: { type: 'NUMBER', description: 'Coordenada Y em pixels' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'type_text',
    description: 'Digita um texto como se o usuário estivesse digitando no teclado. O texto é inserido na posição atual do cursor/foco.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING', description: 'O texto para digitar' },
      },
      required: ['text'],
    },
  },
  {
    name: 'press_key',
    description: 'Pressiona uma tecla específica ou combinação de teclas. Use para Enter, Tab, Escape, setas, atalhos como Ctrl+C, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        key: { type: 'STRING', description: 'Nome da tecla. Exemplos: "enter", "tab", "escape", "backspace", "delete", "up", "down", "left", "right", "home", "end", "space", "f1"-"f12", "a"-"z"' },
        modifiers: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Teclas modificadoras. Valores possíveis: "alt", "control", "shift", "command"' },
      },
      required: ['key'],
    },
  },
  {
    name: 'open_app',
    description: 'Abre um aplicativo no computador. Pode ser o nome do executável ou caminho do aplicativo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nome ou caminho do aplicativo. Exemplos: "firefox", "chrome", "code", "notepad", "nautilus", "/usr/bin/google-chrome"' },
      },
      required: ['name'],
    },
  },
  {
    name: 'open_url',
    description: 'Abre uma URL no navegador padrão do sistema.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: { type: 'STRING', description: 'A URL para abrir. Exemplo: "https://www.google.com"' },
      },
      required: ['url'],
    },
  },
  {
    name: 'scroll',
    description: 'Rola a tela para cima ou para baixo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        direction: { type: 'STRING', description: 'Direção do scroll', enum: ['up', 'down'] },
        amount: { type: 'NUMBER', description: 'Quantidade de scroll (1-10, padrão: 3)' },
      },
      required: ['direction'],
    },
  },
  {
    name: 'get_screen_size',
    description: 'Retorna a resolução da tela (largura e altura em pixels). Útil para calcular coordenadas de clique.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'list_processes',
    description: 'Lista os processos em execução no computador. Útil para verificar se um aplicativo está aberto ou monitorar recursos.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_mouse_position',
    description: 'Retorna a posição atual do cursor do mouse na tela (x, y).',
    parameters: { type: 'OBJECT', properties: {} },
  },
];

const SYSTEM_INSTRUCTION = `Você é o Z Desktop Agent, um assistente de IA que pode controlar o computador do usuário. Você tem acesso a funções que permitem interagir diretamente com o sistema operacional.

CAPACIDADES:
- Executar comandos no terminal
- Capturar screenshots da tela
- Clicar, mover o mouse e digitar texto
- Pressionar teclas e atalhos de teclado
- Abrir aplicativos e URLs
- Rolar a tela
- Verificar processos em execução
- Obter resolução da tela e posição do mouse

DIRETRIZES:
1. Sempre tire um screenshot ANTES de clicar em algo, para saber onde está clicando.
2. Ao executar comandos, prefira comandos seguros. Sempre avise o usuário antes de comandos destrutivos (rm, del, format, etc.).
3. Seja cuidadoso com ações irreversíveis. Peça confirmação quando necessário.
4. Explique o que está fazendo a cada passo.
5. Use português brasileiro para se comunicar com o usuário.
6. Se uma ação falhar, tente entender o motivo e sugira alternativas.
7. Para clicar em elementos específicos, primeiro capture a tela, identifique as coordenadas aproximadas e depois clique.
8. Responda de forma clara e útil, usando markdown para formatação quando apropriado.

IMPORTANTE: Você deve sempre priorizar a segurança do sistema do usuário. Nunca execute comandos que possam danificar o sistema ou comprometer dados sem confirmação explícita.`;

// Execute desktop automation function in the main process
async function executeDesktopFunction(name, args) {
  try {
    let result;
    switch (name) {
      case 'execute_command': {
        const cmdResult = await new Promise((resolve) => {
          exec(args.command, { timeout: args.timeout || 30000, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
            resolve({
              success: !error,
              stdout: stdout || '',
              stderr: stderr || '',
              exitCode: error ? error.code : 0,
              error: error ? error.message : null,
            });
          });
        });
        result = { ...cmdResult, command: args.command, type: 'execute_command' };
        break;
      }

      case 'take_screenshot': {
        result = await takeScreenshotHelper();
        result.type = 'screenshot';
        result.description = args.description || '';
        break;
      }

      case 'mouse_click': {
        const x = args.x, y = args.y, button = args.button || 'left', doubleClick = args.doubleClick || false;
        if (robot) {
          robot.moveMouse(Math.round(x), Math.round(y));
          robot.mouseClick(button, doubleClick);
          result = { success: true, type: 'mouse_click', x, y, button };
        } else {
          result = await fallbackMouseClick(x, y, button, doubleClick);
          result.type = 'mouse_click'; result.x = x; result.y = y; result.button = button;
        }
        break;
      }

      case 'mouse_move': {
        const x = args.x, y = args.y;
        if (robot) {
          robot.moveMouse(Math.round(x), Math.round(y));
          result = { success: true, type: 'mouse_move', x, y };
        } else {
          result = await fallbackMouseMove(x, y);
          result.type = 'mouse_move'; result.x = x; result.y = y;
        }
        break;
      }

      case 'type_text': {
        if (robot) {
          robot.typeString(args.text);
          result = { success: true, type: 'type_text', text: args.text };
        } else {
          result = await fallbackTypeText(args.text);
          result.type = 'type_text'; result.text = args.text;
        }
        break;
      }

      case 'press_key': {
        if (robot) {
          robot.keyTap(args.key, args.modifiers || []);
          result = { success: true, type: 'press_key', key: args.key, modifiers: args.modifiers };
        } else {
          result = await fallbackPressKey(args.key, args.modifiers || []);
          result.type = 'press_key'; result.key = args.key; result.modifiers = args.modifiers;
        }
        break;
      }

      case 'open_app': {
        const appName = args.name;
        const platform = os.platform();
        let command;
        if (platform === 'win32') command = `start "" "${appName}"`;
        else if (platform === 'linux') command = `sh -c "which ${appName} >/dev/null 2>&1 && ${appName} & || xdg-open '${appName}'"`;
        else command = `open "${appName}"`;
        exec(command, (error) => { if (error) console.error('Error opening app:', error); });
        result = { success: true, type: 'open_app', name: appName };
        break;
      }

      case 'open_url': {
        await shell.openExternal(args.url);
        result = { success: true, type: 'open_url', url: args.url };
        break;
      }

      case 'scroll': {
        const amount = args.amount || 3;
        const direction = args.direction || 'down';
        if (robot) {
          const scrollAmount = direction === 'up' ? -Math.abs(amount) : Math.abs(amount);
          robot.scrollMouse(0, scrollAmount);
          result = { success: true, type: 'scroll', direction, amount };
        } else {
          result = await fallbackScroll(amount, direction);
          result.type = 'scroll'; result.direction = direction; result.amount = amount;
        }
        break;
      }

      case 'get_screen_size': {
        if (robot) {
          const size = robot.getScreenSize();
          result = { success: true, type: 'get_screen_size', width: size.width, height: size.height };
        } else {
          const { width, height } = screen.getPrimaryDisplay().workAreaSize;
          result = { success: true, type: 'get_screen_size', width, height };
        }
        break;
      }

      case 'list_processes': {
        const platform = os.platform();
        let command;
        if (platform === 'win32') command = 'tasklist /FO CSV /NH';
        else command = 'ps aux --sort=-%mem | head -30';
        const output = execSync(command, { timeout: 5000 }).toString();
        result = { success: true, type: 'list_processes', output };
        break;
      }

      case 'get_mouse_position': {
        if (robot) {
          const pos = robot.getMousePos();
          result = { success: true, type: 'get_mouse_position', x: pos.x, y: pos.y };
        } else {
          const platform = os.platform();
          if (platform === 'linux') {
            const output = execSync('xdotool getmouselocation --shell', { timeout: 5000 }).toString();
            const matchX = output.match(/X=(\d+)/);
            const matchY = output.match(/Y=(\d+)/);
            if (matchX && matchY) {
              result = { success: true, type: 'get_mouse_position', x: parseInt(matchX[1]), y: parseInt(matchY[1]) };
            } else {
              result = { success: false, type: 'get_mouse_position', error: 'Cannot determine mouse position' };
            }
          } else {
            result = { success: false, type: 'get_mouse_position', error: 'Cannot determine mouse position on this platform' };
          }
        }
        break;
      }

      default:
        result = { success: false, error: `Unknown function: ${name}`, type: name };
    }
    return result;
  } catch (e) {
    return { success: false, error: e.message, type: name };
  }
}

// Helper for screenshot (reusable)
async function takeScreenshotHelper() {
  try {
    let imgPath;
    const platform = os.platform();

    if (screenshot) {
      const tmpDir = os.tmpdir();
      imgPath = path.join(tmpDir, `z-agent-screenshot-${Date.now()}.png`);
      await screenshot({ filename: imgPath });
    } else if (platform === 'linux') {
      const tmpDir = os.tmpdir();
      imgPath = path.join(tmpDir, `z-agent-screenshot-${Date.now()}.png`);
      try { execSync(`import -window root "${imgPath}"`, { timeout: 10000 }); }
      catch { try { execSync(`scrot "${imgPath}"`, { timeout: 10000 }); } catch { try { execSync(`gnome-screenshot -f "${imgPath}"`, { timeout: 10000 }); }
      catch {
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
        if (sources.length > 0) { fs.writeFileSync(imgPath, sources[0].thumbnail.toPNG()); }
      } } }
    } else if (platform === 'win32') {
      const tmpDir = os.tmpdir();
      imgPath = path.join(tmpDir, `z-agent-screenshot-${Date.now()}.png`);
      try {
        const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $bmp = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); $bmp.Save('${imgPath.replace(/\\/g, '\\\\')}'); $g.Dispose(); $bmp.Dispose() }`;
        execSync(`powershell -command "${ps}"`, { timeout: 15000 });
      } catch {
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
        if (sources.length > 0) { fs.writeFileSync(imgPath, sources[0].thumbnail.toPNG()); }
      }
    } else {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
      if (sources.length > 0) {
        imgPath = path.join(os.tmpdir(), `z-agent-screenshot-${Date.now()}.png`);
        fs.writeFileSync(imgPath, sources[0].thumbnail.toPNG());
      } else {
        return { success: false, error: 'No screen source found' };
      }
    }

    if (imgPath && fs.existsSync(imgPath)) {
      const imageData = fs.readFileSync(imgPath);
      const base64 = imageData.toString('base64');
      try { fs.unlinkSync(imgPath); } catch {}
      return { success: true, base64, mimeType: 'image/png' };
    }
    return { success: false, error: 'Failed to capture screenshot' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Helper to format success responses for Gemini function responses
function getSuccessResponse(name, result) {
  switch (name) {
    case 'take_screenshot':
      return { captured: true, description: result.description || 'Screenshot captured' };
    case 'execute_command':
      return { exitCode: result.exitCode, stdout: result.stdout?.substring(0, 2000), stderr: result.stderr?.substring(0, 500) };
    case 'get_screen_size':
      return { width: result.width, height: result.height };
    case 'list_processes':
      return { output: result.output?.substring(0, 2000) };
    case 'get_mouse_position':
      return { x: result.x, y: result.y };
    default:
      return { success: true };
  }
}

// Chat with Gemini - all API calls done in main process (no CORS issues)
ipcMain.handle('chat-gemini', async (event, { apiKey, model, history }) => {
  try {
    if (!apiKey) {
      return { success: false, error: 'API Key não configurada. Abra as configurações.' };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: history,
      tools: [{
        function_declarations: DESKTOP_FUNCTIONS,
      }],
      tool_config: {
        function_calling_config: {
          mode: 'AUTO',
        },
      },
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    };

    const maxRounds = 10;
    let round = 0;
    let allActions = [];

    while (round < maxRounds) {
      round++;

      const response = await makeRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status !== 200) {
        const errorMsg = response.data?.error?.message || `API Error: ${response.status}`;
        const errorStatus = response.data?.error?.status || '';

        // Provide user-friendly error messages
        if (response.status === 400 || errorStatus === 'INVALID_ARGUMENT') {
          return { success: false, error: `Modelo "${model}" não suportado ou parâmetros inválidos. Tente outro modelo. Detalhes: ${errorMsg}` };
        }
        if (response.status === 401) {
          return { success: false, error: 'API Key inválida ou expirada. Verifique sua chave em aistudio.google.com' };
        }
        if (response.status === 403 || errorStatus === 'PERMISSION_DENIED') {
          return { success: false, error: 'API Key não tem permissão para usar este modelo. Habilite a API Generative Language no Google Cloud.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Limite de requisições atingido. Aguarde um momento e tente novamente.' };
        }

        return { success: false, error: errorMsg };
      }

      const data = response.data;
      const candidate = data.candidates?.[0];

      if (!candidate) {
        const blockReason = data.promptFeedback?.blockReason;
        if (blockReason) {
          return { success: false, error: `Conteúdo bloqueado: ${blockReason}. Reformule sua mensagem.` };
        }
        return { success: false, error: 'Sem resposta da API. Tente novamente.' };
      }

      // Check for finish reason
      const finishReason = candidate.finishReason;
      if (finishReason === 'SAFETY') {
        return { success: false, error: 'Resposta bloqueada por filtros de segurança. Reformule sua mensagem.' };
      }

      const parts = candidate.content?.parts || [];

      // Check for function calls
      const functionCalls = parts.filter((p) => p.functionCall);
      const textParts = parts.filter((p) => p.text);

      if (functionCalls.length === 0) {
        // No more function calls - return the text response
        return {
          success: true,
          text: textParts.map((p) => p.text).join(''),
          actions: allActions,
        };
      }

      // Process function calls
      const functionResponses = [];
      for (const fc of functionCalls) {
        const { name, args } = fc.functionCall;
        const actionResult = await executeDesktopFunction(name, args || {});
        allActions.push(actionResult);

        functionResponses.push({
          functionResponse: {
            name,
            response: {
              success: actionResult.success,
              ...(actionResult.success
                ? getSuccessResponse(name, actionResult)
                : { error: actionResult.error || 'Unknown error' }),
            },
          },
        });
      }

      // Add model's response to contents
      body.contents.push({
        role: 'model',
        parts: parts,
      });

      // Add function responses to contents
      body.contents.push({
        role: 'function',
        parts: functionResponses,
      });
    }

    return {
      success: true,
      text: 'Atingi o limite de rodadas de automação. Por favor, continue a conversa para mais ações.',
      actions: allActions,
    };
  } catch (e) {
    return { success: false, error: `Erro na comunicação com a API: ${e.message}` };
  }
});
