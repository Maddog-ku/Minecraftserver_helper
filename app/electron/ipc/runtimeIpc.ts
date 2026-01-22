import { BrowserWindow, ipcMain } from 'electron';
import { ensureJava, onProgress } from '../services/javaRuntimeService';

export const registerRuntimeIpc = () => {
  onProgress((progress) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('runtime:progress', progress);
      }
    }
  });

  ipcMain.handle('runtime:ensureJava', async (_event, version: number) => ensureJava(version as 21));
};
