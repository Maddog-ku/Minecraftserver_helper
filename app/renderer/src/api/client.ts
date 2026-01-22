import type { CoreType, ServerProfile } from '../store/serversStore';

export interface CreateServerPayload {
  displayName: string;
  coreType: CoreType;
  mcVersion: string;
}

export const serverClient = {
  list: () => window.api.server.list() as Promise<ServerProfile[]>,
  create: (payload: CreateServerPayload) => window.api.server.create(payload) as Promise<ServerProfile>,
  rename: (payload: { id: string; displayName: string }) =>
    window.api.server.rename(payload) as Promise<ServerProfile>,
  delete: (payload: { id: string; deleteFiles: boolean }) =>
    window.api.server.delete(payload) as Promise<void>,
  start: (id: string) => window.api.server.start(id) as Promise<ServerProfile>,
  stop: (id: string) => window.api.server.stop(id) as Promise<ServerProfile>,
  status: (id: string) => window.api.server.status(id) as Promise<'running' | 'stopped'>,
  sendCommand: (payload: { id: string; command: string }) =>
    window.api.server.sendCommand(payload) as Promise<void>,
  openFolder: (id: string) => window.api.server.openFolder(id) as Promise<void>,
  onLog: (callback: (payload: { serverId: string; line: string }) => void) =>
    window.api.server.onLog(callback)
};

export const modsClient = {
  pickAndImport: (serverId: string) => window.api.mods.pickAndImport(serverId) as Promise<{
    importedCount: number;
    skippedCount: number;
    conflicts: string[];
    detectedPackType?: 'curseforge';
    mcVersion?: string;
    loaderType?: 'forge' | 'fabric' | 'neoforge' | 'unknown';
    modCount?: number;
    importedOverridesCount?: number;
    importedJarsCount?: number;
  }>,
  pickAndImportFolder: (payload: {
    serverId: string;
    options: { includeConfig: boolean; includeKubejs: boolean; includeDefaultconfigs: boolean };
  }) =>
    window.api.mods.pickAndImportFolder(payload) as Promise<{
      importedCount: number;
      skippedCount: number;
      conflicts: string[];
      importedOverridesCount?: number;
      importedJarsCount?: number;
    }>,
  list: (serverId: string) =>
    window.api.mods.list(serverId) as Promise<{ filename: string; size: number; enabled: boolean }[]>,
  remove: (payload: { serverId: string; filename: string }) =>
    window.api.mods.remove(payload) as Promise<void>,
  toggle: (payload: { serverId: string; filename: string; enabled: boolean }) =>
    window.api.mods.toggle(payload) as Promise<void>
};

export const runtimeClient = {
  ensureJava: (version: number) => window.api.runtime.ensureJava(version) as Promise<{ javaPath: string }>,
  onProgress: (callback: (payload: { phase: 'downloading' | 'extracting' | 'verifying'; percent: number; downloadedBytes: number; totalBytes: number }) => void) =>
    window.api.runtime.onProgress(callback)
};
