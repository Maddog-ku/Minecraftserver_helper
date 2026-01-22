"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openServerFolder = exports.deleteServer = exports.getServerById = exports.setServerStatus = exports.updateServer = exports.renameServer = exports.createServer = exports.listServers = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const paths_1 = require("./paths");
const REGISTRY_VERSION = 1;
const DEFAULT_RAM_MIN = 1024;
const DEFAULT_RAM_MAX = 2048;
const getRegistryPath = () => path_1.default.join((0, paths_1.getAppDataPath)(), 'registry.json');
const normalizeServer = (server) => {
    let changed = false;
    const rootPath = server.rootPath ?? path_1.default.join((0, paths_1.getServersRoot)(), server.id);
    const serverPath = server.serverPath ?? path_1.default.join(rootPath, 'server');
    const ramMinMb = server.ramMinMb ?? DEFAULT_RAM_MIN;
    const ramMaxMb = server.ramMaxMb ?? DEFAULT_RAM_MAX;
    const status = server.status ?? 'stopped';
    if (server.rootPath !== rootPath)
        changed = true;
    if (server.serverPath !== serverPath)
        changed = true;
    if (server.ramMinMb !== ramMinMb)
        changed = true;
    if (server.ramMaxMb !== ramMaxMb)
        changed = true;
    if (server.status !== status)
        changed = true;
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
const readRegistry = async () => {
    await (0, paths_1.ensureAppPaths)();
    const registryPath = getRegistryPath();
    try {
        const raw = await promises_1.default.readFile(registryPath, 'utf-8');
        const parsed = JSON.parse(raw);
        let changed = false;
        const normalizedServers = (parsed.servers ?? []).map((server) => {
            const result = normalizeServer(server);
            if (result.changed)
                changed = true;
            return result.server;
        });
        const normalized = {
            version: parsed.version ?? REGISTRY_VERSION,
            servers: normalizedServers
        };
        if (changed) {
            await saveRegistry(normalized);
        }
        return normalized;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            const empty = { version: REGISTRY_VERSION, servers: [] };
            await saveRegistry(empty);
            return empty;
        }
        throw error;
    }
};
const saveRegistry = async (data) => {
    await (0, paths_1.ensureAppPaths)();
    const registryPath = getRegistryPath();
    const payload = JSON.stringify(data, null, 2);
    await promises_1.default.writeFile(registryPath, payload, 'utf-8');
};
const listServers = async () => {
    const registry = await readRegistry();
    return registry.servers;
};
exports.listServers = listServers;
const createServer = async (input) => {
    const registry = await readRegistry();
    const id = (0, crypto_1.randomUUID)();
    const rootPath = path_1.default.join((0, paths_1.getServersRoot)(), id);
    const serverPath = path_1.default.join(rootPath, 'server');
    const now = new Date().toISOString();
    const profile = {
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
    await promises_1.default.mkdir(serverPath, { recursive: true });
    await saveRegistry(registry);
    return profile;
};
exports.createServer = createServer;
const renameServer = async (id, displayName) => {
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
exports.renameServer = renameServer;
const updateServer = async (id, patch) => {
    const registry = await readRegistry();
    const server = registry.servers.find((item) => item.id === id);
    if (!server) {
        throw new Error('Server not found');
    }
    Object.assign(server, patch, { updatedAt: new Date().toISOString() });
    await saveRegistry(registry);
    return server;
};
exports.updateServer = updateServer;
const setServerStatus = async (id, status) => (0, exports.updateServer)(id, { status });
exports.setServerStatus = setServerStatus;
const getServerById = async (id) => {
    const registry = await readRegistry();
    const server = registry.servers.find((item) => item.id === id);
    if (!server) {
        throw new Error('Server not found');
    }
    return server;
};
exports.getServerById = getServerById;
const deleteServer = async (id, deleteFiles) => {
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
        await promises_1.default.rm(server.rootPath, { recursive: true, force: true });
    }
};
exports.deleteServer = deleteServer;
const openServerFolder = async (id) => {
    const registry = await readRegistry();
    const server = registry.servers.find((item) => item.id === id);
    if (!server) {
        throw new Error('Server not found');
    }
    return server.rootPath;
};
exports.openServerFolder = openServerFolder;
//# sourceMappingURL=registryStore.js.map