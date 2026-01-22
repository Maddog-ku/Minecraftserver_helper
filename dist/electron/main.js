"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const serverIpc_1 = require("./ipc/serverIpc");
const modsIpc_1 = require("./ipc/modsIpc");
const runtimeIpc_1 = require("./ipc/runtimeIpc");
const safeStringify = (value) => {
    try {
        return JSON.stringify(value);
    }
    catch {
        return '"[unserializable]"';
    }
};
const appendFileSafe = (filePath, line) => {
    try {
        fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
        fs_1.default.appendFileSync(filePath, line, 'utf8');
    }
    catch {
        // Ignore logging errors to avoid crashing the app.
    }
};
const appName = electron_1.app.getName();
const bootBase = process.env.APPDATA || process.env.LOCALAPPDATA || process.cwd();
const bootLogDir = path_1.default.join(bootBase, appName, 'logs');
const bootLogPath = path_1.default.join(bootLogDir, 'boot.txt');
const bootTimestamp = new Date().toISOString();
appendFileSafe(bootLogPath, `boot start ${bootTimestamp}\n`);
const bootLog = (message, data) => {
    const timestamp = new Date().toISOString();
    const payload = data ? ` ${safeStringify(data)}` : '';
    appendFileSafe(bootLogPath, `[${timestamp}] ${message}${payload}\n`);
};
let logToFile = bootLog;
process.on('uncaughtException', (error) => {
    logToFile('uncaughtException', { message: error?.message, stack: error?.stack });
});
process.on('unhandledRejection', (reason) => {
    logToFile('unhandledRejection', { reason: safeStringify(reason) });
});
const createWindow = () => {
    const preloadPath = path_1.default.join(__dirname, 'preload.js');
    const mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath
        }
    });
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const indexPath = path_1.default.join(electron_1.app.getAppPath(), 'dist', 'renderer', 'index.html');
    const indexExists = fs_1.default.existsSync(indexPath);
    const debugInfo = {
        appPath: electron_1.app.getAppPath(),
        resourcesPath: process.resourcesPath,
        dirname: __dirname,
        indexPath,
        indexExists,
        preloadPath
    };
    let debugShown = false;
    const showDebugPage = (reason, extra) => {
        if (debugShown)
            return;
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
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
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
    });
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
electron_1.app.whenReady().then(() => {
    const mainLogPath = path_1.default.join(electron_1.app.getPath('userData'), 'logs', 'main.log');
    logToFile = (message, data) => {
        const timestamp = new Date().toISOString();
        const payload = data ? ` ${safeStringify(data)}` : '';
        appendFileSafe(mainLogPath, `[${timestamp}] ${message}${payload}\n`);
    };
    logToFile('paths', {
        userData: electron_1.app.getPath('userData'),
        appPath: electron_1.app.getAppPath(),
        dirname: __dirname,
        resourcesPath: process.resourcesPath
    });
    (0, serverIpc_1.registerServerIpc)();
    (0, modsIpc_1.registerModsIpc)();
    (0, runtimeIpc_1.registerRuntimeIpc)();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
//# sourceMappingURL=main.js.map