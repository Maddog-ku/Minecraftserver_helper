import { dialog, ipcMain } from 'electron';
import { importFromFolder, listMods, pickAndImportMods, removeMod, toggleMod } from '../services/modsService';
import { getMainWindow } from '../utils/window';

export const registerModsIpc = () => {
  ipcMain.handle('mods:list', async (_event, serverId: string) => listMods(serverId));

  ipcMain.handle('mods:pickAndImport', async (_event, serverId: string) => {
    const win = getMainWindow();
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Import Mods',
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: 'Mods', extensions: ['jar', 'zip'] }]
        })
      : await dialog.showOpenDialog({
          title: 'Import Mods',
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: 'Mods', extensions: ['jar', 'zip'] }]
        });

    if (result.canceled || result.filePaths.length === 0) {
      return { importedCount: 0, skippedCount: 0, conflicts: [] };
    }

    return pickAndImportMods(serverId, result.filePaths);
  });

  ipcMain.handle(
    'mods:pickAndImportFolder',
    async (_event, payload: { serverId: string; options: { includeConfig: boolean; includeKubejs: boolean; includeDefaultconfigs: boolean } }) => {
      const win = getMainWindow();
      const result = win
        ? await dialog.showOpenDialog(win, {
            title: 'Import Mods Folder',
            properties: ['openDirectory']
          })
        : await dialog.showOpenDialog({
            title: 'Import Mods Folder',
            properties: ['openDirectory']
          });

      if (result.canceled || result.filePaths.length === 0) {
        return { importedCount: 0, skippedCount: 0, conflicts: [], importedOverridesCount: 0, importedJarsCount: 0 };
      }

      return importFromFolder(payload.serverId, result.filePaths[0], payload.options);
    }
  );

  ipcMain.handle('mods:remove', async (_event, payload: { serverId: string; filename: string }) =>
    removeMod(payload.serverId, payload.filename)
  );

  ipcMain.handle('mods:toggle', async (_event, payload: { serverId: string; filename: string; enabled: boolean }) =>
    toggleMod(payload.serverId, payload.filename, payload.enabled)
  );
};
