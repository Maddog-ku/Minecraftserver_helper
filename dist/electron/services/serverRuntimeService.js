"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCommand = exports.status = exports.stop = exports.start = exports.onLog = void 0;
const child_process_1 = require("child_process");
const registryStore_1 = require("../storage/registryStore");
const javaRuntimeService_1 = require("./javaRuntimeService");
const runtimes = new Map();
const logListeners = new Set();
const emitLog = (serverId, line) => {
    for (const listener of logListeners) {
        listener(serverId, line);
    }
};
const onLog = (listener) => {
    logListeners.add(listener);
    return () => logListeners.delete(listener);
};
exports.onLog = onLog;
const createLineHandler = (serverId, prefix = '') => {
    let buffer = '';
    return (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (line.trim().length === 0)
                continue;
            emitLog(serverId, `${prefix}${line}`);
        }
    };
};
const start = async (serverId) => {
    if (runtimes.has(serverId)) {
        throw new Error('Server is already running.');
    }
    const server = await (0, registryStore_1.getServerById)(serverId);
    let javaPath = server.runtimeJavaPath;
    if (javaPath && !(await (0, javaRuntimeService_1.checkJava)(javaPath))) {
        javaPath = undefined;
    }
    if (!javaPath) {
        const ensured = await (0, javaRuntimeService_1.ensureJava)(21);
        javaPath = ensured.javaPath;
        await (0, registryStore_1.updateServer)(serverId, { runtimeJavaPath: javaPath });
    }
    const args = [
        `-Xms${server.ramMinMb}M`,
        `-Xmx${server.ramMaxMb}M`,
        '-jar',
        'server.jar',
        'nogui'
    ];
    const child = (0, child_process_1.spawn)(javaPath, args, {
        cwd: server.serverPath,
        stdio: 'pipe'
    });
    runtimes.set(serverId, child);
    await (0, registryStore_1.setServerStatus)(serverId, 'running');
    emitLog(serverId, '[SYSTEM] Server starting...');
    child.stdout.on('data', createLineHandler(serverId));
    child.stderr.on('data', createLineHandler(serverId, '[ERR] '));
    child.on('close', async (code, signal) => {
        runtimes.delete(serverId);
        await (0, registryStore_1.setServerStatus)(serverId, 'stopped').catch(() => undefined);
        emitLog(serverId, `[SYSTEM] Server stopped (code ${code ?? 'null'}${signal ? `, signal ${signal}` : ''}).`);
    });
    child.on('error', async (error) => {
        runtimes.delete(serverId);
        await (0, registryStore_1.setServerStatus)(serverId, 'stopped').catch(() => undefined);
        emitLog(serverId, `[SYSTEM] Server error: ${error.message}`);
    });
    return (0, registryStore_1.getServerById)(serverId);
};
exports.start = start;
const waitForExit = (child, timeoutMs) => new Promise((resolve) => {
    const timeout = setTimeout(() => {
        child.kill();
        resolve();
    }, timeoutMs);
    child.once('close', () => {
        clearTimeout(timeout);
        resolve();
    });
});
const stop = async (serverId) => {
    const runtime = runtimes.get(serverId);
    if (!runtime) {
        await (0, registryStore_1.setServerStatus)(serverId, 'stopped');
        return (0, registryStore_1.getServerById)(serverId);
    }
    emitLog(serverId, '[SYSTEM] Stopping server...');
    runtime.stdin.write('stop\n');
    await waitForExit(runtime, 10000);
    await (0, registryStore_1.setServerStatus)(serverId, 'stopped');
    return (0, registryStore_1.getServerById)(serverId);
};
exports.stop = stop;
const status = (serverId) => runtimes.has(serverId) ? 'running' : 'stopped';
exports.status = status;
const sendCommand = async (serverId, command) => {
    const runtime = runtimes.get(serverId);
    if (!runtime) {
        throw new Error('Server is not running.');
    }
    const trimmed = command.trim();
    if (!trimmed)
        return;
    runtime.stdin.write(`${trimmed}\n`);
};
exports.sendCommand = sendCommand;
//# sourceMappingURL=serverRuntimeService.js.map