import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { ensureAppPaths, getAppDataPath, getServersRoot } from './paths';
import type { CoreType, ServerProfile, ServerStatus } from '../domain/ServerProfile';

export interface RegistryData {
  version: number;
  servers: ServerProfile[];
}

const REGISTRY_VERSION = 1;
const DEFAULT_RAM_MIN = 1024;
const DEFAULT_RAM_MAX = 2048;

const getRegistryPath = () => path.join(getAppDataPath(), 'registry.json');

const normalizeServer = (server: ServerProfile): { server: ServerProfile; changed: boolean } => {
  let changed = false;
  const rootPath = server.rootPath ?? path.join(getServersRoot(), server.id);
  const serverPath = server.serverPath ?? path.join(rootPath, 'server');
  const ramMinMb = server.ramMinMb ?? DEFAULT_RAM_MIN;
  const ramMaxMb = server.ramMaxMb ?? DEFAULT_RAM_MAX;
  const status = server.status ?? 'stopped';

  if (server.rootPath !== rootPath) changed = true;
  if (server.serverPath !== serverPath) changed = true;
  if (server.ramMinMb !== ramMinMb) changed = true;
  if (server.ramMaxMb !== ramMaxMb) changed = true;
  if (server.status !== status) changed = true;

  return {
    changed,
    server: {
      ...server,
      rootPath,
      serverPath,
      ramMinMb,
      ramMaxMb,
      status
    }
  };
};

const readRegistry = async (): Promise<RegistryData> => {
  await ensureAppPaths();
  const registryPath = getRegistryPath();
  try {
    const raw = await fs.readFile(registryPath, 'utf-8');
    const parsed = JSON.parse(raw) as RegistryData;
    let changed = false;
    const normalizedServers = (parsed.servers ?? []).map((server) => {
      const result = normalizeServer(server);
      if (result.changed) changed = true;
      return result.server;
    });
    const normalized: RegistryData = {
      version: parsed.version ?? REGISTRY_VERSION,
      servers: normalizedServers
    };
    if (changed) {
      await saveRegistry(normalized);
    }
    return normalized;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const empty: RegistryData = { version: REGISTRY_VERSION, servers: [] };
      await saveRegistry(empty);
      return empty;
    }
    throw error;
  }
};

const saveRegistry = async (data: RegistryData) => {
  await ensureAppPaths();
  const registryPath = getRegistryPath();
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(registryPath, payload, 'utf-8');
};

export const listServers = async () => {
  const registry = await readRegistry();
  return registry.servers;
};

export interface CreateServerInput {
  displayName: string;
  coreType: CoreType;
  mcVersion: string;
}

export const createServer = async (input: CreateServerInput): Promise<ServerProfile> => {
  const registry = await readRegistry();
  const id = randomUUID();
  const rootPath = path.join(getServersRoot(), id);
  const serverPath = path.join(rootPath, 'server');
  const now = new Date().toISOString();

  const profile: ServerProfile = {
    id,
    displayName: input.displayName,
    coreType: input.coreType,
    mcVersion: input.mcVersion,
    ramMinMb: DEFAULT_RAM_MIN,
    ramMaxMb: DEFAULT_RAM_MAX,
    rootPath,
    serverPath,
    status: 'stopped',
    createdAt: now,
    updatedAt: now
  };

  registry.servers.push(profile);
  await fs.mkdir(serverPath, { recursive: true });
  await saveRegistry(registry);
  return profile;
};

export const renameServer = async (id: string, displayName: string): Promise<ServerProfile> => {
  const registry = await readRegistry();
  const server = registry.servers.find((item) => item.id === id);
  if (!server) {
    throw new Error('Server not found');
  }
  server.displayName = displayName;
  server.updatedAt = new Date().toISOString();
  await saveRegistry(registry);
  return server;
};

export const updateServer = async (id: string, patch: Partial<ServerProfile>): Promise<ServerProfile> => {
  const registry = await readRegistry();
  const server = registry.servers.find((item) => item.id === id);
  if (!server) {
    throw new Error('Server not found');
  }
  Object.assign(server, patch, { updatedAt: new Date().toISOString() });
  await saveRegistry(registry);
  return server;
};

export const setServerStatus = async (id: string, status: ServerStatus) =>
  updateServer(id, { status });

export const getServerById = async (id: string) => {
  const registry = await readRegistry();
  const server = registry.servers.find((item) => item.id === id);
  if (!server) {
    throw new Error('Server not found');
  }
  return server;
};

export const deleteServer = async (id: string, deleteFiles: boolean) => {
  const registry = await readRegistry();
  const index = registry.servers.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error('Server not found');
  }
  const server = registry.servers[index];
  if (server.status === 'running') {
    throw new Error('Server is running. Please stop it before deleting.');
  }
  registry.servers.splice(index, 1);
  await saveRegistry(registry);
  if (deleteFiles) {
    await fs.rm(server.rootPath, { recursive: true, force: true });
  }
};

export const openServerFolder = async (id: string) => {
  const registry = await readRegistry();
  const server = registry.servers.find((item) => item.id === id);
  if (!server) {
    throw new Error('Server not found');
  }
  return server.rootPath;
};
