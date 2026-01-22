import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';
import { modsClient, runtimeClient, serverClient } from '../api/client';

export type ServerStatus = 'stopped' | 'running';
export type CoreType = 'vanilla' | 'paper' | 'fabric' | 'forge';

export interface ServerProfile {
  id: string;
  displayName: string;
  coreType: CoreType;
  mcVersion: string;
  ramMinMb: number;
  ramMaxMb: number;
  runtimeJavaPath?: string;
  rootPath: string;
  serverPath: string;
  status: ServerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ModInfo {
  filename: string;
  size: number;
  enabled: boolean;
}

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
  conflicts: string[];
  detectedPackType?: 'curseforge';
  mcVersion?: string;
  loaderType?: 'forge' | 'fabric' | 'neoforge' | 'unknown';
  modCount?: number;
  importedOverridesCount?: number;
  importedJarsCount?: number;
}

export interface FolderImportOptions {
  includeConfig: boolean;
  includeKubejs: boolean;
  includeDefaultconfigs: boolean;
}

export interface RuntimeProgress {
  phase: 'downloading' | 'extracting' | 'verifying';
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export const useServersStore = defineStore('servers', () => {
  const servers = ref<ServerProfile[]>([]);
  const selectedId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const logs = reactive<Record<string, string[]>>({});
  const mods = reactive<Record<string, ModInfo[]>>({});
  const importResults = reactive<Record<string, ImportResult | null>>({});
  const runtimeProgress = ref<RuntimeProgress | null>(null);
  const runtimeModalVisible = ref(false);
  const maxLogLines = 5000;
  let logUnsubscribe: (() => void) | null = null;
  let runtimeUnsubscribe: (() => void) | null = null;

  const selectedServer = computed(() =>
    selectedId.value ? servers.value.find((server) => server.id === selectedId.value) ?? null : null
  );

  const setError = (message: string | null) => {
    error.value = message;
  };

  const appendLog = (serverId: string, line: string) => {
    const entries = logs[serverId] ?? (logs[serverId] = []);
    entries.push(line);
    if (entries.length > maxLogLines) {
      entries.splice(0, entries.length - maxLogLines);
    }
  };

  const subscribeLogs = () => {
    if (logUnsubscribe) return;
    logUnsubscribe = serverClient.onLog(({ serverId, line }) => {
      appendLog(serverId, line);
    });
  };

  const unsubscribeLogs = () => {
    if (logUnsubscribe) {
      logUnsubscribe();
      logUnsubscribe = null;
    }
  };

  const subscribeRuntime = () => {
    if (runtimeUnsubscribe) return;
    runtimeUnsubscribe = runtimeClient.onProgress((progress) => {
      runtimeProgress.value = progress;
      runtimeModalVisible.value = true;
    });
  };

  const unsubscribeRuntime = () => {
    if (runtimeUnsubscribe) {
      runtimeUnsubscribe();
      runtimeUnsubscribe = null;
    }
  };

  const clearRuntimeProgress = () => {
    runtimeProgress.value = null;
    runtimeModalVisible.value = false;
  };

  const loadMods = async (serverId: string) => {
    loading.value = true;
    setError(null);
    try {
      mods[serverId] = await modsClient.list(serverId);
    } catch (err) {
      setError((err as Error).message || 'Failed to load mods.');
    } finally {
      loading.value = false;
    }
  };

  const importMods = async (serverId: string) => {
    loading.value = true;
    setError(null);
    try {
      const result = await modsClient.pickAndImport(serverId);
      importResults[serverId] = result;
      mods[serverId] = await modsClient.list(serverId);
      return result;
    } catch (err) {
      setError((err as Error).message || 'Failed to import mods.');
      return null;
    } finally {
      loading.value = false;
    }
  };

  const importModsFromFolder = async (serverId: string, options: FolderImportOptions) => {
    loading.value = true;
    setError(null);
    try {
      const result = await modsClient.pickAndImportFolder({ serverId, options });
      importResults[serverId] = result;
      mods[serverId] = await modsClient.list(serverId);
      return result;
    } catch (err) {
      setError((err as Error).message || 'Failed to import mods folder.');
      return null;
    } finally {
      loading.value = false;
    }
  };

  const toggleMod = async (serverId: string, filename: string, enabled: boolean) => {
    loading.value = true;
    setError(null);
    try {
      await modsClient.toggle({ serverId, filename, enabled });
      mods[serverId] = await modsClient.list(serverId);
    } catch (err) {
      setError((err as Error).message || 'Failed to toggle mod.');
    } finally {
      loading.value = false;
    }
  };

  const removeMod = async (serverId: string, filename: string) => {
    loading.value = true;
    setError(null);
    try {
      await modsClient.remove({ serverId, filename });
      mods[serverId] = await modsClient.list(serverId);
    } catch (err) {
      setError((err as Error).message || 'Failed to remove mod.');
    } finally {
      loading.value = false;
    }
  };

  const loadServers = async () => {
    loading.value = true;
    setError(null);
    try {
      const list = await serverClient.list();
      servers.value = list;
      if (!selectedId.value && list.length > 0) {
        selectedId.value = list[0].id;
      }
      if (selectedId.value && !list.find((item) => item.id === selectedId.value)) {
        selectedId.value = list[0]?.id ?? null;
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load servers.');
    } finally {
      loading.value = false;
    }
  };

  const createServer = async (payload: {
    displayName: string;
    coreType: CoreType;
    mcVersion: string;
  }) => {
    loading.value = true;
    setError(null);
    try {
      const created = await serverClient.create(payload);
      servers.value = [...servers.value, created];
      selectedId.value = created.id;
      return created;
    } catch (err) {
      setError((err as Error).message || 'Failed to create server.');
      return null;
    } finally {
      loading.value = false;
    }
  };

  const renameServer = async (payload: { id: string; displayName: string }) => {
    loading.value = true;
    setError(null);
    try {
      const updated = await serverClient.rename(payload);
      servers.value = servers.value.map((server) => (server.id === updated.id ? updated : server));
      return updated;
    } catch (err) {
      setError((err as Error).message || 'Failed to rename server.');
      return null;
    } finally {
      loading.value = false;
    }
  };

  const deleteServer = async (payload: { id: string; deleteFiles: boolean }) => {
    loading.value = true;
    setError(null);
    try {
      await serverClient.delete(payload);
      servers.value = servers.value.filter((server) => server.id !== payload.id);
      if (selectedId.value === payload.id) {
        selectedId.value = servers.value[0]?.id ?? null;
      }
      if (logs[payload.id]) {
        delete logs[payload.id];
      }
      if (mods[payload.id]) {
        delete mods[payload.id];
      }
      if (importResults[payload.id]) {
        delete importResults[payload.id];
      }
      return true;
    } catch (err) {
      setError((err as Error).message || 'Failed to delete server.');
      return false;
    } finally {
      loading.value = false;
    }
  };

  const openFolder = async (id: string) => {
    loading.value = true;
    setError(null);
    try {
      await serverClient.openFolder(id);
    } catch (err) {
      setError((err as Error).message || 'Failed to open folder.');
    } finally {
      loading.value = false;
    }
  };

  const startServer = async (id: string) => {
    loading.value = true;
    setError(null);
    try {
      const updated = await serverClient.start(id);
      servers.value = servers.value.map((server) => (server.id === updated.id ? updated : server));
      return updated;
    } catch (err) {
      setError((err as Error).message || 'Failed to start server.');
      return null;
    } finally {
      loading.value = false;
      if (runtimeModalVisible.value) {
        clearRuntimeProgress();
      }
    }
  };

  const stopServer = async (id: string) => {
    loading.value = true;
    setError(null);
    try {
      const updated = await serverClient.stop(id);
      servers.value = servers.value.map((server) => (server.id === updated.id ? updated : server));
      return updated;
    } catch (err) {
      setError((err as Error).message || 'Failed to stop server.');
      return null;
    } finally {
      loading.value = false;
    }
  };

  const refreshStatus = async (id: string) => {
    try {
      const status = await serverClient.status(id);
      servers.value = servers.value.map((server) =>
        server.id === id ? { ...server, status } : server
      );
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch status.');
    }
  };

  const sendCommand = async (id: string, command: string) => {
    loading.value = true;
    setError(null);
    try {
      await serverClient.sendCommand({ id, command });
    } catch (err) {
      setError((err as Error).message || 'Failed to send command.');
    } finally {
      loading.value = false;
    }
  };

  return {
    servers,
    selectedId,
    selectedServer,
    loading,
    error,
    logs,
    mods,
    importResults,
    runtimeProgress,
    runtimeModalVisible,
    loadServers,
    loadMods,
    importMods,
    importModsFromFolder,
    toggleMod,
    removeMod,
    createServer,
    renameServer,
    deleteServer,
    openFolder,
    startServer,
    stopServer,
    refreshStatus,
    sendCommand,
    setError,
    subscribeLogs,
    unsubscribeLogs,
    subscribeRuntime,
    unsubscribeRuntime,
    clearRuntimeProgress
  };
});
