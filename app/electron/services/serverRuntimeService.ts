import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type { ServerStatus } from '../domain/ServerProfile';
import { getServerById, setServerStatus, updateServer } from '../storage/registryStore';
import { checkJava, ensureJava } from './javaRuntimeService';

const runtimes = new Map<string, ChildProcessWithoutNullStreams>();

type LogListener = (serverId: string, line: string) => void;
const logListeners = new Set<LogListener>();

const emitLog = (serverId: string, line: string) => {
  for (const listener of logListeners) {
    listener(serverId, line);
  }
};

export const onLog = (listener: LogListener) => {
  logListeners.add(listener);
  return () => logListeners.delete(listener);
};

const createLineHandler = (serverId: string, prefix = '') => {
  let buffer = '';
  return (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      emitLog(serverId, `${prefix}${line}`);
    }
  };
};

export const start = async (serverId: string) => {
  if (runtimes.has(serverId)) {
    throw new Error('Server is already running.');
  }

  const server = await getServerById(serverId);
  let javaPath = server.runtimeJavaPath;
  if (javaPath && !(await checkJava(javaPath))) {
    javaPath = undefined;
  }
  if (!javaPath) {
    const ensured = await ensureJava(21);
    javaPath = ensured.javaPath;
    await updateServer(serverId, { runtimeJavaPath: javaPath });
  }

  const args = [
    `-Xms${server.ramMinMb}M`,
    `-Xmx${server.ramMaxMb}M`,
    '-jar',
    'server.jar',
    'nogui'
  ];

  const child = spawn(javaPath, args, {
    cwd: server.serverPath,
    stdio: 'pipe'
  });

  runtimes.set(serverId, child);
  await setServerStatus(serverId, 'running');
  emitLog(serverId, '[SYSTEM] Server starting...');

  child.stdout.on('data', createLineHandler(serverId));
  child.stderr.on('data', createLineHandler(serverId, '[ERR] '));

  child.on('close', async (code, signal) => {
    runtimes.delete(serverId);
    await setServerStatus(serverId, 'stopped').catch(() => undefined);
    emitLog(
      serverId,
      `[SYSTEM] Server stopped (code ${code ?? 'null'}${signal ? `, signal ${signal}` : ''}).`
    );
  });

  child.on('error', async (error) => {
    runtimes.delete(serverId);
    await setServerStatus(serverId, 'stopped').catch(() => undefined);
    emitLog(serverId, `[SYSTEM] Server error: ${error.message}`);
  });

  return getServerById(serverId);
};

const waitForExit = (child: ChildProcessWithoutNullStreams, timeoutMs: number) =>
  new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill();
      resolve();
    }, timeoutMs);

    child.once('close', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

export const stop = async (serverId: string) => {
  const runtime = runtimes.get(serverId);
  if (!runtime) {
    await setServerStatus(serverId, 'stopped');
    return getServerById(serverId);
  }

  emitLog(serverId, '[SYSTEM] Stopping server...');
  runtime.stdin.write('stop\n');
  await waitForExit(runtime, 10000);
  await setServerStatus(serverId, 'stopped');
  return getServerById(serverId);
};

export const status = (serverId: string): ServerStatus =>
  runtimes.has(serverId) ? 'running' : 'stopped';

export const sendCommand = async (serverId: string, command: string) => {
  const runtime = runtimes.get(serverId);
  if (!runtime) {
    throw new Error('Server is not running.');
  }
  const trimmed = command.trim();
  if (!trimmed) return;
  runtime.stdin.write(`${trimmed}\n`);
};
