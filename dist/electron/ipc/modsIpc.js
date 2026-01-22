"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerModsIpc = void 0;
const electron_1 = require("electron");
const modsService_1 = require("../services/modsService");
const window_1 = require("../utils/window");
const registerModsIpc = () => {
    electron_1.ipcMain.handle('mods:list', async (_event, serverId) => (0, modsService_1.listMods)(serverId));
    electron_1.ipcMain.handle('mods:pickAndImport', async (_event, serverId) => {
        const win = (0, window_1.getMainWindow)();
        const result = win
            ? await electron_1.dialog.showOpenDialog(win, {
                title: 'Import Mods',
                properties: ['openFile', 'multiSelections'],
                filters: [{ name: 'Mods', extensions: ['jar', 'zip'] }]
            })
            : await electron_1.dialog.showOpenDialog({
                title: 'Import Mods',
                properties: ['openFile', 'multiSelections'],
                filters: [{ name: 'Mods', extensions: ['jar', 'zip'] }]
            });
        if (result.canceled || result.filePaths.length === 0) {
            return { importedCount: 0, skippedCount: 0, conflicts: [] };
        }
        return (0, modsService_1.pickAndImportMods)(serverId, result.filePaths);
    });
    electron_1.ipcMain.handle('mods:pickAndImportFolder', async (_event, payload) => {
        const win = (0, window_1.getMainWindow)();
        const result = win
            ? await electron_1.dialog.showOpenDialog(win, {
                title: 'Import Mods Folder',
                properties: ['openDirectory']
            })
            : await electron_1.dialog.showOpenDialog({
                title: 'Import Mods Folder',
                properties: ['openDirectory']
            });
        if (result.canceled || result.filePaths.length === 0) {
            return { importedCount: 0, skippedCount: 0, conflicts: [], importedOverridesCount: 0, importedJarsCount: 0 };
        }
        return (0, modsService_1.importFromFolder)(payload.serverId, result.filePaths[0], payload.options);
    });
    electron_1.ipcMain.handle('mods:remove', async (_event, payload) => (0, modsService_1.removeMod)(payload.serverId, payload.filename));
    electron_1.ipcMain.handle('mods:toggle', async (_event, payload) => (0, modsService_1.toggleMod)(payload.serverId, payload.filename, payload.enabled));
};
exports.registerModsIpc = registerModsIpc;
//# sourceMappingURL=modsIpc.js.map