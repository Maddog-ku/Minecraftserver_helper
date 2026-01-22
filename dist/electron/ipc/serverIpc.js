"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerServerIpc = void 0;
const electron_1 = require("electron");
const registryStore_1 = require("../storage/registryStore");
const serverRuntimeService_1 = require("../services/serverRuntimeService");
const registerServerIpc = () => {
    (0, serverRuntimeService_1.onLog)((serverId, line) => {
        for (const window of electron_1.BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) {
                window.webContents.send('server:log', { serverId, line });
            }
        }
    });
    electron_1.ipcMain.handle('server:list', async () => (0, registryStore_1.listServers)());
    electron_1.ipcMain.handle('server:create', async (_event, payload) => (0, registryStore_1.createServer)(payload));
    electron_1.ipcMain.handle('server:rename', async (_event, payload) => (0, registryStore_1.renameServer)(payload.id, payload.displayName));
    electron_1.ipcMain.handle('server:delete', async (_event, payload) => (0, registryStore_1.deleteServer)(payload.id, payload.deleteFiles));
    electron_1.ipcMain.handle('server:start', async (_event, id) => (0, serverRuntimeService_1.start)(id));
    electron_1.ipcMain.handle('server:stop', async (_event, id) => (0, serverRuntimeService_1.stop)(id));
    electron_1.ipcMain.handle('server:status', async (_event, id) => (0, serverRuntimeService_1.status)(id));
    electron_1.ipcMain.handle('server:sendCommand', async (_event, payload) => (0, serverRuntimeService_1.sendCommand)(payload.id, payload.command));
    electron_1.ipcMain.handle('server:openFolder', async (_event, id) => {
        const path = await (0, registryStore_1.openServerFolder)(id);
        const result = await electron_1.shell.openPath(path);
        if (result) {
            throw new Error(result);
        }
    });
};
exports.registerServerIpc = registerServerIpc;
//# sourceMappingURL=serverIpc.js.map