import { contextBridge, ipcRenderer } from 'electron';
import type { CoreType, ServerProfile } from './domain/ServerProfile';

export type Api = {
  server: {
    list: () => Promise<ServerProfile[]>;
    create: (payload: { displayName: string; coreType: CoreType; mcVersion: string }) => Promise<ServerProfile>;
    rename: (payload: { id: string; displayName: string }) => Promise<ServerProfile>;
    delete: (payload: { id: string; deleteFiles: boolean }) => Promise<void>;
    start: (id: string) => Promise<ServerProfile>;
    stop: (id: string) => Promise<ServerProfile>;
    status: (id: string) => Promise<'running' | 'stopped'>;
    sendCommand: (payload: { id: string; command: string }) => Promise<void>;
    openFolder: (id: string) => Promise<void>;
    onLog: (callback: (payload: { serverId: string; line: string }) => void) => () => void;
  };
  mods: {
    pickAndImport: (serverId: string) => Promise<{
      importedCount: number;
      skippedCount: number;
      conflicts: string[];
      detectedPackType?: 'curseforge';
      mcVersion?: string;
      loaderType?: 'forge' | 'fabric' | 'neoforge' | 'unknown';
      modCount?: number;
      importedOverridesCount?: number;
      importedJarsCount?: number;
    }>;
    pickAndImportFolder: (payload: {
      serverId: string;
      options: { includeConfig: boolean; includeKubejs: boolean; includeDefaultconfigs: boolean };
    }) => Promise<{
      importedCount: number;
      skippedCount: number;
      conflicts: string[];
      importedOverridesCount?: number;
      importedJarsCount?: number;
    }>;
    list: (serverId: string) => Promise<{ filename: string; size: number; enabled: boolean }[]>;
    remove: (payload: { serverId: string; filename: string }) => Promise<void>;
    toggle: (payload: { serverId: string; filename: string; enabled: boolean }) => Promise<void>;
  };
  runtime: {
    ensureJava: (version: number) => Promise<{ javaPath: string }>;
    onProgress: (callback: (payload: { phase: 'downloading' | 'extracting' | 'verifying'; percent: number; downloadedBytes: number; totalBytes: number }) => void) => () => void;
  };
};

const api: Api = {
  server: {
    list: () => ipcRenderer.invoke('server:list'),
    create: (payload) => ipcRenderer.invoke('server:create', payload),
    rename: (payload) => ipcRenderer.invoke('server:rename', payload),
    delete: (payload) => ipcRenderer.invoke('server:delete', payload),
    start: (id) => ipcRenderer.invoke('server:start', id),
    stop: (id) => ipcRenderer.invoke('server:stop', id),
    status: (id) => ipcRenderer.invoke('server:status', id),
    sendCommand: (payload) => ipcRenderer.invoke('server:sendCommand', payload),
    openFolder: (id) => ipcRenderer.invoke('server:openFolder', id),
    onLog: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { serverId: string; line: string }) =>
        callback(payload);
      ipcRenderer.on('server:log', listener);
      return () => ipcRenderer.removeListener('server:log', listener);
    }
  },
  mods: {
    pickAndImport: (serverId) => ipcRenderer.invoke('mods:pickAndImport', serverId),
    pickAndImportFolder: (payload) => ipcRenderer.invoke('mods:pickAndImportFolder', payload),
    list: (serverId) => ipcRenderer.invoke('mods:list', serverId),
    remove: (payload) => ipcRenderer.invoke('mods:remove', payload),
    toggle: (payload) => ipcRenderer.invoke('mods:toggle', payload)
  },
  runtime: {
    ensureJava: (version) => ipcRenderer.invoke('runtime:ensureJava', version),
    onProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { phase: 'downloading' | 'extracting' | 'verifying'; percent: number; downloadedBytes: number; totalBytes: number }) =>
        callback(payload);
      ipcRenderer.on('runtime:progress', listener);
      return () => ipcRenderer.removeListener('runtime:progress', listener);
    }
  }
};

contextBridge.exposeInMainWorld('api', api);
