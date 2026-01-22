import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerServerIpc } from './ipc/serverIpc';
import { registerModsIpc } from './ipc/modsIpc';
import { registerRuntimeIpc } from './ipc/runtimeIpc';

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
    console.error('did-fail-load', { errorCode, errorDescription, validatedURL });
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('render-process-gone', details);
  });
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const indexPath = path.join(app.getAppPath(), 'dist', 'renderer', 'index.html');
  if (!fs.existsSync(indexPath)) {
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
