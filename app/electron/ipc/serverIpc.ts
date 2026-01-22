import { BrowserWindow, ipcMain, shell } from 'electron';
import {
  createServer,
  deleteServer,
  listServers,
  openServerFolder,
  renameServer
} from '../storage/registryStore';
import type { CoreType } from '../domain/ServerProfile';
import { onLog, sendCommand, start, status, stop } from '../services/serverRuntimeService';

export const registerServerIpc = () => {
  onLog((serverId, line) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('server:log', { serverId, line });
      }
    }
  });

  ipcMain.handle('server:list', async () => listServers());

  ipcMain.handle(
    'server:create',
    async (_event, payload: { displayName: string; coreType: CoreType; mcVersion: string }) =>
      createServer(payload)
  );

  ipcMain.handle(
    'server:rename',
    async (_event, payload: { id: string; displayName: string }) =>
      renameServer(payload.id, payload.displayName)
  );

  ipcMain.handle(
    'server:delete',
    async (_event, payload: { id: string; deleteFiles: boolean }) =>
      deleteServer(payload.id, payload.deleteFiles)
  );

  ipcMain.handle('server:start', async (_event, id: string) => start(id));

  ipcMain.handle('server:stop', async (_event, id: string) => stop(id));

  ipcMain.handle('server:status', async (_event, id: string) => status(id));

  ipcMain.handle('server:sendCommand', async (_event, payload: { id: string; command: string }) =>
    sendCommand(payload.id, payload.command)
  );

  ipcMain.handle('server:openFolder', async (_event, id: string) => {
    const path = await openServerFolder(id);
    const result = await shell.openPath(path);
    if (result) {
      throw new Error(result);
    }
  });
};
