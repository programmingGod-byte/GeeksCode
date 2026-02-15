const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pty = require('node-pty');
const axios = require('axios');
const crypto = require('crypto');

const ragService = require('./src/utils/ragService');
const codeModel = require('./src/utils/codeModel');
const testCaseModel = require('./src/utils/testCaseModel');
const { LucideEthernetPort } = require('lucide-react');

let mainWindow;
let ptyProcess = null;
let ptyExitListener = null;

// Global AI state
let llama = null;
let model = null;
let context = null;
let activeModelId = 'deepseek'; // Default model
const sessions = new Map(); // Map of sessionId -> LlamaChatSession
const initializingSessions = new Set(); // To prevent race conditions in init

const AI_MODELS = {
  'deepseek': {
    id: 'deepseek',
    name: 'DeepSeek Coder 1.3B',
    url: 'https://huggingface.co/TheBloke/deepseek-coder-1.3b-instruct-GGUF/resolve/main/deepseek-coder-1.3b-instruct.Q4_K_M.gguf',
    filename: 'deepseek-1.3b.gguf',
    expectedSize: 873582624
  },
  'qwen': {
    id: 'qwen',
    name: 'Qwen2.5 Coder 1.5B',
    url: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    filename: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    expectedSize: null // Size can vary or be unknown
  }
};

const NOMIC_MODEL_URL = "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF/resolve/main/nomic-embed-text-v1.5.Q4_K_M.gguf";
const NOMIC_FILENAME = "nomic-embed-text-v1.5.Q4_K_M.gguf";

// ... existing code ...  

ipcMain.handle('ai:delete-model', async (_, modelId) => {
  let success = true;

  try {
    if (modelId) {
      // Delete specific model
      const m = AI_MODELS[modelId];
      if (m) {
        const filePath = path.join(app.getPath('userData'), m.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else if (modelId === 'nomic') {
        const nomicPath = path.join(app.getPath('userData'), NOMIC_FILENAME);
        if (fs.existsSync(nomicPath)) {
          fs.unlinkSync(nomicPath);
        }
      }
    } else {
      // Delete ALL (Legacy fallback)
      for (const m of Object.values(AI_MODELS)) {
        const filePath = path.join(app.getPath('userData'), m.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      const nomicPath = path.join(app.getPath('userData'), NOMIC_FILENAME);
      if (fs.existsSync(nomicPath)) fs.unlinkSync(nomicPath);
    }

    // Reset AI state if anything was deleted
    model = null;
    context = null;
    sessions.clear();
    globalAIInitPromise = null;
    return true;
  } catch (e) {
    console.error('Error in ai:delete-model:', e);
    return false;
  }
});

function createWindow() {
  const isMac = process.platform === 'darwin';

  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Code Editor',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true, // Enable <webview> tag
    },
  };

  if (isMac) {
    windowOptions.titleBarStyle = 'hiddenInset';
    windowOptions.trafficLightPosition = { x: 12, y: 10 };
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.maximize();

  // In dev mode, load from Vite dev server; in production load the built output
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });

  // Build a custom menu to override Cmd+W / Ctrl+W
  const menuTemplate = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('close-active-tab');
            }
          },
        },
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-folder');
            }
          },
        },
        {
          label: 'Close Folder',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('close-folder');
            }
          },
        },
        { type: "separator" },
        {
          label: 'Codeforces Settings',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('codeforces:open-settings');
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // Context Menu Implementation
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' },
    ]);
    menu.popup({ window: mainWindow });
  });

  // ─── Bypass X-Frame-Options for In-App Browser ───
  // ─── Bypass X-Frame-Options for In-App Browser ───
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['*://*/*'] }, // Apply to all URLs
    (details, callback) => {
      const responseHeaders = Object.assign({}, details.responseHeaders);

      const keysToRemove = [
        'x-frame-options',
        'content-security-policy',
        'frame-options',
        'x-content-type-options' // Sometimes causes issues with MIME types in iframes
      ];

      Object.keys(responseHeaders).forEach(key => {
        if (keysToRemove.includes(key.toLowerCase())) {
          delete responseHeaders[key];
        }
      });

      callback({ cancel: false, responseHeaders });
    }
  );
}

function ParseCode(code) {
  const lines = code.split('\n')
  const results = []

  for (const line of lines) {
    let i = 0
    while (i < line.length) {
      if (
        line[i] === '!' &&
        line[i + 1] === '@' &&
        line[i + 2] === '#' &&
        line[i + 3] === '$'
      ) {
        i += 4
        if (line[i] !== '(') {
          return 'Invalid Syntax'
        }
        i++
        let temp = ''
        while (i < line.length && line[i] !== ')') {
          temp += line[i]
          i++
        }
        if (i >= line.length) {
          return 'Invalid Syntax'
        }
        results.push(temp)
      }
      i++
    }
  }
  return results
}
ipcMain.handle('parsed-code', async (event, code) => {
  let prompts = ParseCode(code)
  let finalCppCode;
  if (prompts.length !== 0) {
    const modelPath = path.join(app.getPath('userData'), 'deepseek-1.3b.gguf');
    await codeModel.init(modelPath);
    finalCppCode = await codeModel.query(code);
    console.log(finalCppCode);
  } else {
    finalCppCode = code;
  }
  return {
    success: true,
    cppCode: finalCppCode
  }
})

ipcMain.handle('generate-testcases', async (event, code, count) => {
  try {
    const modelPath = path.join(app.getPath('userData'), 'deepseek-1.3b.gguf');
    await testCaseModel.init(modelPath);
    const testCases = await testCaseModel.generate(code, count);
    console.log('Generated test cases:', testCases);
    return {
      success: true,
      testCases: testCases
    };
  } catch (error) {
    console.error('Test case generation failed:', error);
    return {
      success: false,
      testCases: [],
      error: error.message
    };
  }
})

let globalAutocompleteSequence = null;

async function getSequenceWithRetry(context, retryCount = 0) {
  try {
    return context.getSequence();
  } catch (err) {
    if (err.message.includes("No sequences left") && retryCount < 3) {
      console.warn(`AI: No sequences left (Attempt ${retryCount + 1}). Recycling...`);

      // 0. Kill Autocomplete FIRST (Lowest priority)
      if (globalAutocompleteSequence && !globalAutocompleteSequence.disposed) {
        try {
          globalAutocompleteSequence.dispose();
          globalAutocompleteSequence = null;
          console.log("AI: Force-killed autocomplete sequence to free resources.");
          // Retry immediately
          return await getSequenceWithRetry(context, retryCount + 1);
        } catch (e) {
          console.warn("Error disposing autocomplete sequence:", e);
        }
      }

      const iterator = sessions.keys();
      const oldestSessionId = iterator.next().value;

      if (oldestSessionId) {
        const oldSessionData = sessions.get(oldestSessionId);
        if (oldSessionData && oldSessionData.sequence) {
          try {
            if (!oldSessionData.sequence.disposed) {
              oldSessionData.sequence.dispose();
              console.log(`AI: Force-recycled session: ${oldestSessionId}`);
            }
          } catch (e) {
            console.warn(`Error disposing session ${oldestSessionId}:`, e);
          }
        }
        sessions.delete(oldestSessionId);
      } else {

        console.warn("AI: No sessions to recycle. Waiting for ephemeral sequences to free up...");
        await new Promise(r => setTimeout(r, 200 * (retryCount + 1)));
      }

      return await getSequenceWithRetry(context, retryCount + 1);
    }
    throw err;
  }
}

ipcMain.handle('submit-code', async (event, code) => {
  let prompts = ParseCode(code)
  let finalCppCode;
  if (prompts.length !== 0) {
    const activeModel = AI_MODELS[activeModelId];
    const modelPath = path.join(app.getPath('userData'), activeModel.filename);
    await codeModel.init(modelPath);
    finalCppCode = await codeModel.query(code);
    console.log(finalCppCode);
  } else {
    finalCppCode = code;
  }

  const tmpDir = os.tmpdir()
  const cppPath = path.join(tmpDir, 'temp.cpp')
  fs.writeFileSync(cppPath, finalCppCode)

  return {
    success: true,
    cppPath: cppPath
  }
})


app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── IPC: App/Zoom ──────────────────────────────────────────
ipcMain.handle('app:set-zoom', (_, level) => {
  if (mainWindow) {
    mainWindow.webContents.setZoomLevel(level);
    return true;
  }
  return false;
});

ipcMain.handle('app:get-zoom', () => {
  if (mainWindow) {
    return mainWindow.webContents.getZoomLevel();
  }
  return 0;
});

// ─── IPC: Dialog ────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ─── IPC: File System ───────────────────────────────────────
ipcMain.handle('fs:readDir', async (_, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // skip hidden
      results.push({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
      });
    }
    // Sort: directories first, then alphabetical
    results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    return results;
  } catch (e) {
    console.error('fs:readDir error', e);
    return [];
  }
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error('fs:readFile error', e);
    return null;
  }
});

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    console.error('fs:writeFile error', e);
    return false;
  }
});

ipcMain.handle('fs:createFile', async (_, filePath) => {
  try {
    if (fs.existsSync(filePath)) return false;
    fs.writeFileSync(filePath, '', 'utf-8');
    return true;
  } catch (e) {
    console.error('fs:createFile error', e);
    return false;
  }
});

ipcMain.handle('fs:createFolder', async (_, folderPath) => {
  try {
    if (fs.existsSync(folderPath)) return false;
    fs.mkdirSync(folderPath, { recursive: true });
    return true;
  } catch (e) {
    console.error('fs:createFolder error', e);
    return false;
  }
});

ipcMain.handle('fs:deleteFile', async (_, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    console.error('fs:deleteFile error', e);
    return false;
  }
});

ipcMain.handle('fs:deleteFolder', async (_, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) return false;
    fs.rmSync(folderPath, { recursive: true, force: true });
    return true;
  } catch (e) {
    console.error('fs:deleteFolder error', e);
    return false;
  }
});

// ─── IPC: RAG Agent ─────────────────────────────────────────
ipcMain.handle('rag:index', async (event, projectFiles) => {
  // Ensure RAG service is initialized with model if possible
  if (!ragService.modelPath) {
    const nomicPath = path.join(app.getPath('userData'), NOMIC_FILENAME);
    if (fs.existsSync(nomicPath)) {
      console.log("RAG: Auto-initializing for Project index...");
      await ragService.init(app.getPath('userData'), nomicPath);
    } else {
      console.warn("RAG: Cannot index Project, model not found at", nomicPath);
      return false;
    }
  }

  await ragService.indexProject(projectFiles, (current, total, filename) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('rag:progress', { current, total, filename, type: 'project' });
    }
  });
  return true;
});

ipcMain.handle('rag:query', async (_, query) => {
  return ragService.query(query);
});

// ... (fs:indexProject existing code) ...

// ... (existing code) ...

ipcMain.handle('rag:index-kb', async (event) => {
  const kbPath = path.join(__dirname, 'src', 'cp_dsa_knowledge_base');

  // Ensure RAG service is initialized with model if possible
  if (!ragService.modelPath) {
    const nomicPath = path.join(app.getPath('userData'), NOMIC_FILENAME);
    if (fs.existsSync(nomicPath)) {
      console.log("RAG: Auto-initializing for KB index...");
      await ragService.init(app.getPath('userData'), nomicPath);
    } else {
      console.warn("RAG: Cannot index KB, model not found at", nomicPath);
      return false;
    }
  }

  if (fs.existsSync(kbPath)) {
    await ragService.indexDirectory(kbPath, (current, total, filename) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('rag:progress', { current, total, filename, type: 'kb' });
      }
    });
    return true;
  }
  return false;
});

ipcMain.handle('fs:indexProject', async (_, rootPath) => {
  const results = [];
  const walk = (dir) => {
    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          // Ignore heavy/vcs dirs
          if (['node_modules', '.git', 'dist', 'build', '.next', '.venv'].includes(file.name)) continue;
          walk(fullPath);
        } else {
          const ext = path.extname(file.name).toLowerCase();
          const allowedExts = ['.cpp', '.h', '.hpp', '.c', '.js', '.jsx', '.json', '.css', '.md', '.py', '.txt', '.sh'];
          if (allowedExts.includes(ext)) {
            results.push({
              name: file.name,
              path: fullPath,
              relativePath: path.relative(rootPath, fullPath)
            });
          }
        }
      }
    } catch (e) {
      console.warn(`Error walking dir ${dir}:`, e);
    }
  };

  try {
    if (!rootPath || !fs.existsSync(rootPath)) return [];
    walk(rootPath);
    return results;
  } catch (err) {
    console.error('fs:indexProject error', err);
    return [];
  }
});

ipcMain.handle('fs:search', async (_, rootPath, query, options = {}) => {
  console.log(`fs:search called with root=${rootPath}, query=${query}, options=${JSON.stringify(options)}`);
  const results = [];
  if (!rootPath || !query) return [];
  const queryLower = query.toLowerCase();

  const walk = (dir) => {
    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'build', '.next', '.venv', '.gemini'].includes(file.name)) continue;
          walk(fullPath);
        } else {
          const ext = path.extname(file.name).toLowerCase();
          const allowedExtensions = options.extensions || ['.cpp', '.hpp', '.h', '.c'];

          if (allowedExtensions.includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.toLowerCase().includes(queryLower)) {
                  results.push({
                    filePath: fullPath,
                    fileName: file.name,
                    line: i + 1,
                    text: line.trim()
                  });
                  if (results.length > 500) return;
                }
              }
            } catch (e) { }
          }
        }
        if (results.length > 500) return;
      }
    } catch (e) {
      console.warn(`Error walking dir ${dir}:`, e);
    }
  };

  try {
    walk(rootPath);
    console.log(`fs:search found ${results.length} results`);
    return results;
  } catch (err) {
    console.error('fs:search error', err);
    return [];
  }
});

ipcMain.handle('shell:run', async (_, command, cwd) => {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(command, { cwd: cwd || os.homedir() }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout,
        stderr: stderr,
        exitCode: error ? error.code : 0
      });
    });
  });
});

// ─── IPC: Terminal (node-pty) ───────────────────────────────
// Fix: Ensure spawn-helper has execution permissions on macOS
if (process.platform === 'darwin') {
  try {
    const ptyPath = require.resolve('node-pty');
    const ptyDir = path.dirname(ptyPath);
    const arch = process.arch;
    const spawnHelperPath = path.join(ptyDir, '..', 'prebuilds', `darwin-${arch}`, 'spawn-helper');

    if (fs.existsSync(spawnHelperPath)) {
      const stats = fs.statSync(spawnHelperPath);
      // Check if not executable (0o111 means --x--x--x)
      if (!(stats.mode & 0o111)) {
        console.log(`Fixing permissions for node-pty spawn-helper: ${spawnHelperPath}`);
        fs.chmodSync(spawnHelperPath, 0o755);
      }
    }
  } catch (err) {
    console.error('Failed to check/fix node-pty spawn-helper permissions:', err);
  }
}

let currentWorkspacePath = os.homedir();

function createTerminalProcess(cols, rows) {
  if (ptyProcess) {
    if (ptyExitListener) {
      ptyExitListener.dispose();
      ptyExitListener = null;
    }
    ptyProcess.kill();
  }

  const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh';

  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: currentWorkspacePath,
    env: process.env,
  });

  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', data);
    }
  });

  ptyExitListener = ptyProcess.onExit(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:exit');
    }
    ptyProcess = null;
    ptyExitListener = null;
  });
}

ipcMain.handle('terminal:create', (_, cols, rows) => {
  createTerminalProcess(cols, rows);
  return true;
});

ipcMain.on('terminal:write', (_, data) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.on('terminal:resize', (_, cols, rows) => {
  if (ptyProcess) {
    try {
      ptyProcess.resize(cols, rows);
    } catch (e) {
      // ignore resize errors
    }
  }
});

ipcMain.on('terminal:cwd', (_, cwd) => {
  currentWorkspacePath = cwd;
  // Re-create terminal in new CWD
  createTerminalProcess(80, 24);
});

// ─── AI Integration ─────────────────────────────────────────

async function downloadModel(event, url, filename, expectedSize = null, displayName = "Model") {
  const savePath = path.join(app.getPath('userData'), filename);

  if (fs.existsSync(savePath)) {
    const stats = fs.statSync(savePath);
    if (!expectedSize || stats.size === expectedSize) {
      console.log(`${displayName} already exists and size matches (or no size check).`);
      return savePath;
    }
    console.warn(`${displayName} size mismatch: found ${stats.size}, expected ${expectedSize}. Re-downloading...`);
    fs.unlinkSync(savePath); // remove corrupted file
  }

  try {
    const response = await axios({
      url: url,
      method: 'GET',
      responseType: 'stream'
    });

    const totalSize = parseInt(response.headers['content-length'], 10) || expectedSize;
    let downloaded = 0;

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(savePath);
      response.data.on('data', (chunk) => {
        downloaded += chunk.length;
        if (event && !event.sender.isDestroyed()) {
          const progress = totalSize ? ((downloaded / totalSize) * 100).toFixed(2) : 0;
          event.sender.send('ai:download-progress', progress, `Downloading ${displayName}...`);
        }
      });

      response.data.pipe(writer);

      writer.on('finish', () => {
        // Second verification after download
        const stats = fs.statSync(savePath);
        if (totalSize && stats.size !== totalSize) {
          fs.unlink(savePath, () => { });
          reject(new Error(`Download incomplete for ${displayName}: expected ${totalSize} bytes, got ${stats.size} bytes`));
        } else {
          resolve(savePath);
        }
      });
      writer.on('error', (err) => {
        fs.unlink(savePath, () => { }); // cleanup partial file
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Download failed for ${displayName}:`, error);
    throw error;
  }
}

// 2. Start the AI
let globalAIInitPromise = null;
let sessionInitLock = false;
let currentLoadedModelPath = null;

async function initAIModel(modelPath, sessionId = 'default', createSession = true) {
  if (sessions.has(sessionId) && currentLoadedModelPath === modelPath) return true;

  // If we don't need a session, just check if context exists
  if (!createSession && context && currentLoadedModelPath === modelPath) return true;

  while (sessionInitLock) await new Promise(r => setTimeout(r, 50));
  if (sessions.has(sessionId) && currentLoadedModelPath === modelPath) return true;

  sessionInitLock = true;
  try {
    // If model path changed, we must reset
    if (currentLoadedModelPath !== modelPath) {
      console.log(`AI: Model path changed from ${currentLoadedModelPath} to ${modelPath}. Resetting backend...`);
      model = null;
      context = null;
      sessions.clear();
      globalAIInitPromise = null;
      currentLoadedModelPath = modelPath;
    }

    if (!globalAIInitPromise) {
      globalAIInitPromise = (async () => {
        const { getLlama } = await import("node-llama-cpp");
        console.log("AI: Initializing Llama backend...");

        // Conservative initialization: CPU-only to avoid SIGILL/CUDA issues
        let currentLlama = await getLlama({ gpu: 'auto' });
        llama = currentLlama;

        console.log("AI: Backend initialized. Loading model...");
        if (!model) {
          try {
            model = await llama.loadModel({
              modelPath,
              // gpuLayers: 0
            });
            console.log("AI: Model loaded successfully.");
          } catch (loadErr) {
            console.error("AI: Critical error during model load:", loadErr);
            throw loadErr;
          }
        }

        if (!context) {
          console.log("AI: Creating context...");
          context = await model.createContext({
            contextSize: 2048,
            sequences: 2 // Allow Chat + Complexity sessions (Recycling handles the rest)
          });
          console.log("AI: Context created.");
        }
        return { model, context };
      })();
    }

    const { context: aiContext } = await globalAIInitPromise;

    if (!createSession) {
      // Just ensuring context is ready
      return true;
    }

    if (aiContext.sequencesLeft === 0) {
      console.warn("No sequences left. Recycling the oldest session...");
      // Find the oldest session (first key in Map) to recycle
      const iterator = sessions.keys();
      const oldestSessionId = iterator.next().value;
      if (oldestSessionId) {
        const oldSessionData = sessions.get(oldestSessionId);
        if (oldSessionData && oldSessionData.sequence) {
          try {
            if (!oldSessionData.sequence.disposed) {
              oldSessionData.sequence.dispose();
              console.log(`Recycled session: ${oldestSessionId}`);
            }
          } catch (e) {
            console.warn(`Error disposing session ${oldestSessionId}:`, e);
          }
        }
        sessions.delete(oldestSessionId);
      }
    }

    const { LlamaChatSession } = await import("node-llama-cpp");
    const sequence = aiContext.getSequence();
    const chatSession = new LlamaChatSession({
      contextSequence: sequence,
      systemPrompt: "You are a helpful coding assistant. When asked for code, always provide implementation in C++ unless another language is explicitly requested."
    });

    sessions.set(sessionId, { session: chatSession, sequence });
    console.log(`AI Session initialized: ${sessionId}`);
    return true;
  } catch (err) {
    console.error(`AI Init failed for session ${sessionId}:`, err);
    return false;
  } finally {
    sessionInitLock = false;
  }
}

// IPC Handlers
ipcMain.handle('ai:init', async (event, sessionId = 'default') => {
  try {
    // Download Active Model
    const activeModel = AI_MODELS[activeModelId];
    const modelPath = await downloadModel(event, activeModel.url, activeModel.filename, activeModel.expectedSize, activeModel.name);

    // Download Nomic
    const nomicPath = await downloadModel(event, NOMIC_MODEL_URL, NOMIC_FILENAME, null, "Nomic Embed");

    // Initialize RAG Service
    await ragService.init(app.getPath('userData'), nomicPath);


    await initAIModel(path.join(app.getPath('userData'), activeModel.filename), sessionId);

    /*
    // Auto-index Knowledge Base if not already done
    const kbPath = path.join(__dirname, 'src', 'cp_dsa_knowledge_base');
    if (fs.existsSync(kbPath)) {
        console.log("RAG: Auto-indexing KB after initial download...");
        // Use the optimized indexDirectory which skips already indexed files
        await ragService.indexDirectory(kbPath, (current, total, filename) => {
            if (!event.sender.isDestroyed()) {
                event.sender.send('rag:progress', { current, total, filename, type: 'kb' });
            }
        });
    }
    */

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});



ipcMain.handle('ai:check-model', () => {
  const activeModel = AI_MODELS[activeModelId];
  if (!activeModel) return false;

  const modelPath = path.join(app.getPath('userData'), activeModel.filename);
  const nomicPath = path.join(app.getPath('userData'), NOMIC_FILENAME);

  // Check Active Model
  if (!fs.existsSync(modelPath)) return false;
  // Only check size if expectedSize is known
  if (activeModel.expectedSize) {
    const stats = fs.statSync(modelPath);
    if (stats.size !== activeModel.expectedSize) return false;
  }

  // Check Nomic (optional size check if we knew it, for now just existence)
  if (!fs.existsSync(nomicPath)) return false;

  return true;
});

ipcMain.handle('ai:get-active-model', () => {
  return activeModelId;
});

ipcMain.handle('ai:set-model', (_, modelId) => {
  if (AI_MODELS[modelId]) {
    activeModelId = modelId;
    return true;
  }
  return false;
});

ipcMain.handle('ai:get-models', () => {
  const result = {};
  for (const [id, m] of Object.entries(AI_MODELS)) {
    const filePath = path.join(app.getPath('userData'), m.filename);
    result[id] = {
      ...m,
      downloaded: fs.existsSync(filePath)
    };
  }
  return result;
});

ipcMain.handle('ai:ask', async (event, userPrompt, sessionId = 'default') => {
  let sessionData = sessions.get(sessionId);

  // Auto-initialize if session is missing (e.g., recycled)
  if (!sessionData) {
    console.log(`AI: Session "${sessionId}" not found (likely recycled). Re-initializing...`);
    const activeModel = AI_MODELS[activeModelId];
    if (activeModel) {
      await initAIModel(path.join(app.getPath('userData'), activeModel.filename), sessionId);
      sessionData = sessions.get(sessionId);
    }
  }

  if (!sessionData) {
    console.warn(`AI Ask failed: Session ${sessionId} still not initialized`);
    return "AI is not initialized. Please wait.";
  }
  const { session } = sessionData;
  try {
    let augmentedPrompt = userPrompt;

    // Only perform RAG retrieval for general chat, skip for specialized tasks like complexity analysis
    // We also check if the prompt looks like it's asking for personal/config stuff that shouldn't search docs
    // skip RAG for very short messages or greetings
    const isGreeting = /^(hi|hello|hey|hola|yo|hello there)/i.test(userPrompt.trim());
    const tooShort = userPrompt.trim().length < 10;
    const skipRAG = sessionId === 'complexity-session' || sessionId.startsWith('system-') || isGreeting || tooShort;

    if (!skipRAG) {
      console.log(`AI: [Session ${sessionId}] Retrieving RAG context...`);
      // Strictly request only 3 chunks
      const contextItems = await ragService.query(userPrompt, 3).catch(e => {
        console.warn("RAG: Query failed, skipping context", e);
        return [];
      });

      if (contextItems.length > 0) {
        const contextString = contextItems.map(item => `[Source: ${item.source}]\n${item.text}`).join("\n\n");
        // Final safety truncation of context string
        const truncatedContext = contextString.substring(0, 4000);
        augmentedPrompt = `Relevant Context:\n---------------------\n${truncatedContext}\n---------------------\nInstruction: Use the context above if relevant, otherwise use your general knowledge. Respond to: ${userPrompt}`;
        console.log(`AI: [Session ${sessionId}] Augmented prompt with ${contextItems.length} chunks.`);
      }
    } else {
      console.log(`AI: [Session ${sessionId}] Skipping RAG augmentation (Session: ${sessionId}, Greeting/Short: ${isGreeting || tooShort}).`);
    }

    console.log(`AI: [Session ${sessionId}] Sending prompt to model...`);
    const response = await session.prompt(augmentedPrompt);
    console.log(`AI: [Session ${sessionId}] Response received.`);
    return response || "(Empty response from AI)";
  } catch (error) {
    console.error(`AI: [Session ${sessionId}] Prompt failed:`, error);
    return `Error: ${error.message}`;
  }
});

ipcMain.handle('ai:destroy-session', async (event, sessionId) => {
  if (sessions.has(sessionId)) {
    const sessionData = sessions.get(sessionId);
    // Dispose context sequence if available
    if (sessionData.sequence) {
      try {
        if (!sessionData.sequence.disposed) {
          sessionData.sequence.dispose();
        }
      } catch (e) {
        console.warn(`Error disposing session ${sessionId}:`, e);
      }
    }
    sessions.delete(sessionId);
    console.log(`AI Session destroyed: ${sessionId}`);
    return true;
  }
  return false;
});

// ─── Codeforces credentials ──────────────────────────────
const CF_CONFIG_PATH = path.join(app.getPath('userData'), 'cf_config.json');

ipcMain.handle('codeforces:save-creds', async (_, creds) => {
  try {
    fs.writeFileSync(CF_CONFIG_PATH, JSON.stringify(creds), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error saving CF creds:', e);
    return false;
  }
});

const generateCodeforcesSig = (methodName, params, secret) => {
  const rand = Math.floor(Math.random() * 899999) + 100000;
  const sortedParams = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
  const text = `${rand}/${methodName}?${sortedParams}#${secret}`;
  const hash = crypto.createHash('sha512').update(text).digest('hex');
  return `${rand}${hash}`;
};

ipcMain.handle('codeforces:get-submissions', async (_, handle) => {
  try {
    const response = await axios.get(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=20`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    return response.data;
  } catch (error) {
    console.error('Codeforces submissions Error:', error.message);
    if (error.response) {
      return { status: 'FAILED', comment: error.response.data.comment || `HTTP ${error.response.status}` };
    }
    return { status: 'FAILED', comment: error.message };
  }
});

ipcMain.handle('codeforces:get-user-info', async (_, handle) => {
  try {
    const response = await axios.get(`https://codeforces.com/api/user.info?handles=${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    return response.data;
  } catch (error) {
    console.error('Codeforces user.info Error:', error.message);
    if (error.response) {
      return { status: 'FAILED', comment: error.response.data.comment || `HTTP ${error.response.status}` };
    }
    return { status: 'FAILED', comment: error.message };
  }
});

async function getCFCreds() {
  if (fs.existsSync(CF_CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CF_CONFIG_PATH, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

ipcMain.handle('codeforces:get-creds', async () => {
  return getCFCreds();
});


// ─── Codeforces Dataset Filtering ──────────────────────────
const DATASET_PATH = path.join(__dirname, 'src', 'codeforces_dataset');

ipcMain.handle('codeforces:get-dataset-metadata', async () => {
  try {
    if (!fs.existsSync(DATASET_PATH)) return { topics: [], ratings: [], tags: [] };

    const topics = fs.readdirSync(DATASET_PATH).filter(f => fs.statSync(path.join(DATASET_PATH, f)).isDirectory());
    const ratingsSet = new Set();
    const tagsSet = new Set();

    for (const topic of topics) {
      const topicPath = path.join(DATASET_PATH, topic);
      const ratings = fs.readdirSync(topicPath).filter(f => fs.statSync(path.join(topicPath, f)).isDirectory());
      ratings.forEach(r => ratingsSet.add(r));

      for (const rating of ratings) {
        const ratingPath = path.join(topicPath, rating);
        const files = fs.readdirSync(ratingPath).filter(f => f.endsWith('.json'));

        // Sample some files to get tags (scanning all might be slow, but let's try for now if dataset is medium)
        for (const file of files) {
          try {
            const content = JSON.parse(fs.readFileSync(path.join(ratingPath, file), 'utf-8'));
            if (content.tags) content.tags.forEach(t => tagsSet.add(t));
          } catch (e) { /* ignore corrupt files */ }
        }
      }
    }

    return {
      topics: topics.sort(),
      ratings: Array.from(ratingsSet).sort((a, b) => parseInt(a) - parseInt(b)),
      tags: Array.from(tagsSet).sort()
    };
  } catch (e) {
    console.error('Error getting CF dataset metadata:', e);
    return { topics: [], ratings: [], tags: [] };
  }
});

ipcMain.handle('codeforces:get-filtered-problems', async (_, filters) => {
  const { topic, rating, tag, search } = filters;
  const problems = [];

  try {
    if (!fs.existsSync(DATASET_PATH)) return [];

    const scanTopics = topic ? [topic] : fs.readdirSync(DATASET_PATH).filter(f => fs.statSync(path.join(DATASET_PATH, f)).isDirectory());

    for (const t of scanTopics) {
      const topicPath = path.join(DATASET_PATH, t);
      const scanRatings = rating ? [rating] : fs.readdirSync(topicPath).filter(f => fs.statSync(path.join(topicPath, f)).isDirectory());

      for (const r of scanRatings) {
        const ratingPath = path.join(topicPath, r);
        if (!fs.existsSync(ratingPath)) continue;

        const files = fs.readdirSync(ratingPath).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const filePath = path.join(ratingPath, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

            // Apply filters
            if (tag && (!content.tags || !content.tags.includes(tag))) continue;
            if (search && !content.title.toLowerCase().includes(search.toLowerCase())) continue;

            problems.push({
              title: content.title,
              contestId: content.contestId,
              index: content.index,
              rating: content.rating,
              tags: content.tags,
              path: filePath,
              topic: t
            });
          } catch (e) { /* ignore */ }
        }
      }
    }
    return problems;
  } catch (e) {
    console.error('Error filtering problems:', e);
    return [];
  }
});

// ─── IPC: Editor State ────────────────────────────────────────
ipcMain.handle('editor:save-state', async (_, state) => {
  const statePath = path.join(os.homedir(), '.geeks_editor_state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  return true;
});

ipcMain.handle('editor:get-state', async () => {
  const statePath = path.join(os.homedir(), '.geeks_editor_state.json');
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
});

// Autocomplete handler
ipcMain.handle('ai:complete', async (event, codeContext) => {
  if (!context) return null;
  let tempSession = null;
  let sequence = null;
  try {
    const { LlamaChatSession } = await import("node-llama-cpp");
    // For autocomplete, we try to get a sequence. If context is full, this might fail unless we recycle.
    // But autocomplete is ephemeral.
    sequence = await getSequenceWithRetry(context);
    globalAutocompleteSequence = sequence;

    tempSession = new LlamaChatSession({
      contextSequence: sequence
    });

    const [prefix, suffix] = codeContext.split('<CURSOR>');
    const prompt = `<｜fim_begin｜>${prefix}<｜fim_hole｜>${suffix}<｜fim_end｜>`;

    const response = await tempSession.prompt(prompt, {
      maxTokens: 50,
      temperature: 0.1,
      stopOnTokens: ["\n", "}", ";", "<｜fim_end｜>"]
    });

    return response.trim();
  } catch (error) {
    console.error("AI Autocomplete failed:", error);
    return null;
  } finally {
    if (sequence && !sequence.disposed) {
      try {
        sequence.dispose();
      } catch (e) {
        console.error("Error disposing autocomplete sequence:", e);
      }
    }
    if (globalAutocompleteSequence === sequence) {
      globalAutocompleteSequence = null;
    }
  }
});

// Inline Prompt Handler (~("prompt"))
ipcMain.handle('ai:inline-prompt', async (event, code, prompt, lineNumber) => {
  if (!context) {
    console.log("AI: Context not initialized for inline prompt. Auto-initializing...");
    const activeModel = AI_MODELS[activeModelId];
    if (activeModel) {
      try {
        await initAIModel(path.join(app.getPath('userData'), activeModel.filename), 'inline-session', false);
      } catch (e) {
        console.error("AI: Auto-init failed:", e);
        return `// Error: AI initialization failed: ${e.message}`;
      }
    } else {
      return `// Error: No active model selected`;
    }
  }

  if (!context) {
    return `// Error: AI failed to initialize`;
  }

  let tempSession = null;
  let sequence = null;

  try {
    const { LlamaChatSession } = await import("node-llama-cpp");

    // 1. Context Truncation
    const lines = code.split('\n');
    const startLine = Math.max(0, lineNumber - 50); // 50 lines before
    const endLine = Math.min(lines.length, lineNumber + 20); // 20 lines after

    // Add line numbers to context for the model
    const contextLines = lines
      .slice(startLine, endLine)
      .map((line, idx) => `${startLine + idx + 1}: ${line}`);

    const contextBlock = contextLines.join('\n');

    // 2. Construct Prompt
    const systemInstruction = `You are an expert coding assistant.
User Request: "${prompt}"
Task: Write valid C++ code to fulfill the User Request.
Output ONLY the requested code. Do NOT output explanations or markdown backticks.`;

    const userMsg = `Request: "${prompt}"
Context:
${contextBlock}

Write the code for "${prompt}". Only return the code.`;

    // 3. Execution
    sequence = await getSequenceWithRetry(context);
    tempSession = new LlamaChatSession({
      contextSequence: sequence
    });

    console.log(`AI: Inline prompt processing for line ${lineNumber}: "${prompt}"`);

    const response = await tempSession.prompt(userMsg, {
      systemPrompt: systemInstruction,
      temperature: 0.2, // Low temperature for deterministic code
      maxTokens: 1024
    });

    console.log("AI: Inline response generated.");

    // Cleanup response (robust extraction)
    let cleanResponse = response.trim();

    // Regex to find first code block ```...```
    const codeBlockMatch = cleanResponse.match(/```(?:[a-zA-Z]*)\n([\s\S]*?)```/);

    if (codeBlockMatch) {
      cleanResponse = codeBlockMatch[1].trim();
    } else {
      // Fallback: If no code block, try to strip potential "Sure..." text if it appears to be a mixed response
      // But valid code might not be in a block. 
      // Let's remove lines that don't look like code if they are at the start? 
      // For now, simpler is creating a heuristic: 
      // If response starts with text and then has code, the prompt instructions should have prevented this, 
      // but 'deepseek' can be chatty.

      // Simple heuristic: remove lines starting with "Sure", "Here", "Okay"
      const lines = cleanResponse.split('\n');
      if (lines.length > 0 && /^(sure|here|okay|certainly|i can|below is)/i.test(lines[0])) {
        cleanResponse = lines.slice(1).join('\n').trim();
      }
    }

    return cleanResponse;

  } catch (error) {
    console.error("AI Inline Prompt failed:", error);
    return `// Error generating code: ${error.message}`;
  } finally {
    if (sequence && !sequence.disposed) {
      try {
        sequence.dispose();
        console.log("AI: Inline prompt sequence disposed.");
      } catch (e) {
        console.error("Error disposing inline prompt sequence:", e);
      }
    }
  }
});
