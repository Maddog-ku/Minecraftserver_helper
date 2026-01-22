"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRuntimeIpc = void 0;
const electron_1 = require("electron");
const javaRuntimeService_1 = require("../services/javaRuntimeService");
const registerRuntimeIpc = () => {
    (0, javaRuntimeService_1.onProgress)((progress) => {
        for (const window of electron_1.BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) {
                window.webContents.send('runtime:progress', progress);
            }
        }
    });
    electron_1.ipcMain.handle('runtime:ensureJava', async (_event, version) => (0, javaRuntimeService_1.ensureJava)(version));
};
exports.registerRuntimeIpc = registerRuntimeIpc;
//# sourceMappingURL=runtimeIpc.js.map