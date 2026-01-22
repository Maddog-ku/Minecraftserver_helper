import { app } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import https from 'https';
import AdmZip from 'adm-zip';
import { spawn } from 'child_process';

export type RuntimePhase = 'downloading' | 'extracting' | 'verifying';

export interface RuntimeProgress {
  phase: RuntimePhase;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

type ProgressListener = (progress: RuntimeProgress) => void;
const listeners = new Set<ProgressListener>();

export const onProgress = (listener: ProgressListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emitProgress = (progress: RuntimeProgress) => {
  for (const listener of listeners) {
    listener(progress);
  }
};

// Strategy A: use app.getPath('userData') for a stable, writable, cross‑platform location.
const runtimeRoot = () => path.join(app.getPath('userData'), 'runtime');
const javaDir = () => path.join(runtimeRoot(), 'java-21');
const cacheDir = () => path.join(runtimeRoot(), 'cache');

const TEMURIN_21_JRE_URL =
  'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse';

const ensureDirs = async () => {
  await fs.mkdir(runtimeRoot(), { recursive: true });
  await fs.mkdir(javaDir(), { recursive: true });
  await fs.mkdir(cacheDir(), { recursive: true });
};

const fileExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const findJavaExe = async (root: string, maxDepth = 4) => {
  const isWin = process.platform === 'win32';
  const javaBin = isWin ? 'java.exe' : 'java';
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;

    const candidate = path.join(current.dir, 'bin', javaBin);
    if (await fileExists(candidate)) {
      return candidate;
    }

    if (current.depth >= maxDepth) continue;

    let entries: fsSync.Dirent[] = [];
    try {
      entries = await fs.readdir(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
      }
    }
  }

  return null;
};

const downloadFile = async (url: string, dest: string, redirectCount = 0): Promise<void> =>
  new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many redirects while downloading Java runtime.'));
      return;
    }

    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const nextUrl = new URL(response.headers.location, url).toString();
        response.resume();
        downloadFile(nextUrl, dest, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Java download failed with status ${response.statusCode}`));
        response.resume();
        return;
      }

      const totalBytes = Number(response.headers['content-length'] ?? 0);
      let downloadedBytes = 0;

      emitProgress({
        phase: 'downloading',
        percent: 0,
        downloadedBytes,
        totalBytes
      });

      const fileStream = fsSync.createWriteStream(dest);

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const percent = totalBytes ? Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100)) : 0;
        emitProgress({
          phase: 'downloading',
          percent,
          downloadedBytes,
          totalBytes
        });
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        emitProgress({
          phase: 'downloading',
          percent: 100,
          downloadedBytes,
          totalBytes
        });
        resolve();
      });

      fileStream.on('error', (error) => {
        response.resume();
        reject(error);
      });
    });

    request.on('error', (error) => reject(error));
  });

export const checkJava = async (javaPath: string) =>
  new Promise<boolean>((resolve) => {
    const proc = spawn(javaPath, ['-version']);
    let resolved = false;

    proc.on('error', () => {
      if (resolved) return;
      resolved = true;
      resolve(false);
    });

    proc.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      resolve(code === 0);
    });
  });

export const ensureJava = async (version: 21) => {
  if (version !== 21) {
    throw new Error('Only Java 21 is supported in this runtime helper.');
  }

  await ensureDirs();

  const existingJava = await findJavaExe(javaDir());
  if (existingJava && (await checkJava(existingJava))) {
    return { javaPath: existingJava };
  }

  const zipPath = path.join(cacheDir(), 'temurin-21-jre.zip');
  await downloadFile(TEMURIN_21_JRE_URL, zipPath);

  emitProgress({ phase: 'extracting', percent: 0, downloadedBytes: 0, totalBytes: 0 });

  const extractRoot = await fs.mkdtemp(path.join(cacheDir(), 'extract-'));
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractRoot, true);

    const foundJava = await findJavaExe(extractRoot, 5);
    if (!foundJava) {
      throw new Error('Java executable not found after extraction.');
    }

    const javaHome = path.dirname(path.dirname(foundJava));
    await fs.rm(javaDir(), { recursive: true, force: true });
    await fs.mkdir(javaDir(), { recursive: true });
    try {
      await fs.rename(javaHome, javaDir());
    } catch {
      await fs.cp(javaHome, javaDir(), { recursive: true });
    }

    emitProgress({ phase: 'extracting', percent: 100, downloadedBytes: 0, totalBytes: 0 });
  } finally {
    await fs.rm(extractRoot, { recursive: true, force: true });
  }

  emitProgress({ phase: 'verifying', percent: 0, downloadedBytes: 0, totalBytes: 0 });

  const javaPath = await findJavaExe(javaDir());
  if (!javaPath) {
    throw new Error('Java executable not found after install.');
  }

  const ok = await checkJava(javaPath);
  emitProgress({ phase: 'verifying', percent: 100, downloadedBytes: 0, totalBytes: 0 });
  if (!ok) {
    throw new Error('Java verification failed.');
  }

  return { javaPath };
};
