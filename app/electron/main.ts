import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerServerIpc } from './ipc/serverIpc';
import { registerModsIpc } from './ipc/modsIpc';
import { registerRuntimeIpc } from './ipc/runtimeIpc';

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
};

const appendFileSafe = (filePath: string, line: string) => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, line, 'utf8');
  } catch {
    // Ignore logging errors to avoid crashing the app.
  }
};

const appName = app.getName();
const bootBase = process.env.APPDATA || process.env.LOCALAPPDATA || process.cwd();
const bootLogDir = path.join(bootBase, appName, 'logs');
const bootLogPath = path.join(bootLogDir, 'boot.txt');
const bootTimestamp = new Date().toISOString();

appendFileSafe(bootLogPath, `boot start ${bootTimestamp}\n`);

const bootLog = (message: string, data?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  const payload = data ? ` ${safeStringify(data)}` : '';
  appendFileSafe(bootLogPath, `[${timestamp}] ${message}${payload}\n`);
};

let logToFile: (message: string, data?: Record<string, unknown>) => void = bootLog;

process.on('uncaughtException', (error) => {
  logToFile('uncaughtException', { message: error?.message, stack: error?.stack });
});

process.on('unhandledRejection', (reason) => {
  logToFile('unhandledRejection', { reason: safeStringify(reason) });
});

const createWindow = () => {
  const preloadPath = path.join(__dirname, 'preload.js');
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const indexPath = path.join(app.getAppPath(), 'dist', 'renderer', 'index.html');
  const indexExists = fs.existsSync(indexPath);
  const debugInfo = {
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    dirname: __dirname,
    indexPath,
    indexExists,
    preloadPath
  };

  let debugShown = false;
  const showDebugPage = (reason: string, extra?: Record<string, unknown>) => {
    if (debugShown) return;
    debugShown = true;
    logToFile('show-debug-page', { reason, ...debugInfo, ...extra });
    const debugText = JSON.stringify({ reason, ...debugInfo, ...extra }, null, 2);
    const errorHtml = `
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h2>Failed to load UI</h2>
          <pre>${debugText}</pre>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
  };

  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      logToFile('did-fail-load', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      });
      console.error('did-fail-load', { errorCode, errorDescription, validatedURL, isMainFrame });
      if (!devUrl && isMainFrame) {
        showDebugPage('did-fail-load', { errorCode, errorDescription, validatedURL });
      }
    }
  );
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logToFile('render-process-gone', { details });
    console.error('render-process-gone', details);
  });
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logToFile('renderer-console', { level, message, line, sourceId });
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  logToFile('paths', debugInfo);

  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  if (!indexExists) {
    showDebugPage('index-missing');
    return;
  }

  mainWindow.loadFile(indexPath);
  mainWindow.webContents.openDevTools({ mode: 'detach' });
};

app.whenReady().then(() => {
  const mainLogPath = path.join(app.getPath('userData'), 'logs', 'main.log');
  logToFile = (message: string, data?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const payload = data ? ` ${safeStringify(data)}` : '';
    appendFileSafe(mainLogPath, `[${timestamp}] ${message}${payload}\n`);
  };

  logToFile('paths', {
    userData: app.getPath('userData'),
    appPath: app.getAppPath(),
    dirname: __dirname,
    resourcesPath: process.resourcesPath
  });

  registerServerIpc();
  registerModsIpc();
  registerRuntimeIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
