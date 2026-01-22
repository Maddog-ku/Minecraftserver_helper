"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    server: {
        list: () => electron_1.ipcRenderer.invoke('server:list'),
        create: (payload) => electron_1.ipcRenderer.invoke('server:create', payload),
        rename: (payload) => electron_1.ipcRenderer.invoke('server:rename', payload),
        delete: (payload) => electron_1.ipcRenderer.invoke('server:delete', payload),
        start: (id) => electron_1.ipcRenderer.invoke('server:start', id),
        stop: (id) => electron_1.ipcRenderer.invoke('server:stop', id),
        status: (id) => electron_1.ipcRenderer.invoke('server:status', id),
        sendCommand: (payload) => electron_1.ipcRenderer.invoke('server:sendCommand', payload),
        openFolder: (id) => electron_1.ipcRenderer.invoke('server:openFolder', id),
        onLog: (callback) => {
            const listener = (_event, payload) => callback(payload);
            electron_1.ipcRenderer.on('server:log', listener);
            return () => electron_1.ipcRenderer.removeListener('server:log', listener);
        }
    },
    mods: {
        pickAndImport: (serverId) => electron_1.ipcRenderer.invoke('mods:pickAndImport', serverId),
        pickAndImportFolder: (payload) => electron_1.ipcRenderer.invoke('mods:pickAndImportFolder', payload),
        list: (serverId) => electron_1.ipcRenderer.invoke('mods:list', serverId),
        remove: (payload) => electron_1.ipcRenderer.invoke('mods:remove', payload),
        toggle: (payload) => electron_1.ipcRenderer.invoke('mods:toggle', payload)
    },
    runtime: {
        ensureJava: (version) => electron_1.ipcRenderer.invoke('runtime:ensureJava', version),
        onProgress: (callback) => {
            const listener = (_event, payload) => callback(payload);
            electron_1.ipcRenderer.on('runtime:progress', listener);
            return () => electron_1.ipcRenderer.removeListener('runtime:progress', listener);
        }
    }
};
electron_1.contextBridge.exposeInMainWorld('api', api);
//# sourceMappingURL=preload.js.map