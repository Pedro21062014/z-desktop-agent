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
