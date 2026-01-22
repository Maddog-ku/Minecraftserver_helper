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
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logToFile('did-fail-load', { errorCode, errorDescription, validatedURL });
    console.error('did-fail-load', { errorCode, errorDescription, validatedURL });
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('render-process-gone', details);
  });
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logToFile('renderer-console', { level, message, line, sourceId });
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  const indexPath = path.join(app.getAppPath(), 'dist', 'renderer', 'index.html');
  logToFile('paths', {
    appPath: app.getAppPath(),
    dirname: __dirname,
    indexPath,
    indexExists: fs.existsSync(indexPath)
  });
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  if (!fs.existsSync(indexPath)) {
    logToFile('index-missing', {
      appPath: app.getAppPath(),
      dirname: __dirname,
      indexPath
    });
    console.error('index.html not found for production build.', {
      appPath: app.getAppPath(),
      dirname: __dirname,
      indexPath
    });
    const errorHtml = `
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h2>Failed to load UI</h2>
          <p>index.html not found.</p>
          <pre>${indexPath}</pre>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    return;
  }

  mainWindow.loadFile(indexPath);
  // Production debug: comment out when not needed.
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
    dirname: __dirname
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
