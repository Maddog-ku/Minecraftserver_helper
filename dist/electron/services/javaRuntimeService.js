"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureJava = exports.checkJava = exports.onProgress = void 0;
const electron_1 = require("electron");
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const child_process_1 = require("child_process");
const listeners = new Set();
const onProgress = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
exports.onProgress = onProgress;
const emitProgress = (progress) => {
    for (const listener of listeners) {
        listener(progress);
    }
};
// Strategy A: use app.getPath('userData') for a stable, writable, cross‑platform location.
const runtimeRoot = () => path_1.default.join(electron_1.app.getPath('userData'), 'runtime');
const javaDir = () => path_1.default.join(runtimeRoot(), 'java-21');
const cacheDir = () => path_1.default.join(runtimeRoot(), 'cache');
const TEMURIN_21_JRE_URL = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse';
const ensureDirs = async () => {
    await promises_1.default.mkdir(runtimeRoot(), { recursive: true });
    await promises_1.default.mkdir(javaDir(), { recursive: true });
    await promises_1.default.mkdir(cacheDir(), { recursive: true });
};
const fileExists = async (targetPath) => {
    try {
        await promises_1.default.access(targetPath);
        return true;
    }
    catch {
        return false;
    }
};
const findJavaExe = async (root, maxDepth = 4) => {
    const isWin = process.platform === 'win32';
    const javaBin = isWin ? 'java.exe' : 'java';
    const queue = [{ dir: root, depth: 0 }];
    while (queue.length) {
        const current = queue.shift();
        if (!current)
            break;
        const candidate = path_1.default.join(current.dir, 'bin', javaBin);
        if (await fileExists(candidate)) {
            return candidate;
        }
        if (current.depth >= maxDepth)
            continue;
        let entries = [];
        try {
            entries = await promises_1.default.readdir(current.dir, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                queue.push({ dir: path_1.default.join(current.dir, entry.name), depth: current.depth + 1 });
            }
        }
    }
    return null;
};
const downloadFile = async (url, dest, redirectCount = 0) => new Promise((resolve, reject) => {
    if (redirectCount > 5) {
        reject(new Error('Too many redirects while downloading Java runtime.'));
        return;
    }
    const request = https_1.default.get(url, (response) => {
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
        const fileStream = fs_1.default.createWriteStream(dest);
        response.on('data', (chunk) => {
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
const checkJava = async (javaPath) => new Promise((resolve) => {
    const proc = (0, child_process_1.spawn)(javaPath, ['-version']);
    let resolved = false;
    proc.on('error', () => {
        if (resolved)
            return;
        resolved = true;
        resolve(false);
    });
    proc.on('close', (code) => {
        if (resolved)
            return;
        resolved = true;
        resolve(code === 0);
    });
});
exports.checkJava = checkJava;
const ensureJava = async (version) => {
    if (version !== 21) {
        throw new Error('Only Java 21 is supported in this runtime helper.');
    }
    await ensureDirs();
    const existingJava = await findJavaExe(javaDir());
    if (existingJava && (await (0, exports.checkJava)(existingJava))) {
        return { javaPath: existingJava };
    }
    const zipPath = path_1.default.join(cacheDir(), 'temurin-21-jre.zip');
    await downloadFile(TEMURIN_21_JRE_URL, zipPath);
    emitProgress({ phase: 'extracting', percent: 0, downloadedBytes: 0, totalBytes: 0 });
    const extractRoot = await promises_1.default.mkdtemp(path_1.default.join(cacheDir(), 'extract-'));
    try {
        const zip = new adm_zip_1.default(zipPath);
        zip.extractAllTo(extractRoot, true);
        const foundJava = await findJavaExe(extractRoot, 5);
        if (!foundJava) {
            throw new Error('Java executable not found after extraction.');
        }
        const javaHome = path_1.default.dirname(path_1.default.dirname(foundJava));
        await promises_1.default.rm(javaDir(), { recursive: true, force: true });
        await promises_1.default.mkdir(javaDir(), { recursive: true });
        try {
            await promises_1.default.rename(javaHome, javaDir());
        }
        catch {
            await promises_1.default.cp(javaHome, javaDir(), { recursive: true });
        }
        emitProgress({ phase: 'extracting', percent: 100, downloadedBytes: 0, totalBytes: 0 });
    }
    finally {
        await promises_1.default.rm(extractRoot, { recursive: true, force: true });
    }
    emitProgress({ phase: 'verifying', percent: 0, downloadedBytes: 0, totalBytes: 0 });
    const javaPath = await findJavaExe(javaDir());
    if (!javaPath) {
        throw new Error('Java executable not found after install.');
    }
    const ok = await (0, exports.checkJava)(javaPath);
    emitProgress({ phase: 'verifying', percent: 100, downloadedBytes: 0, totalBytes: 0 });
    if (!ok) {
        throw new Error('Java verification failed.');
    }
    return { javaPath };
};
exports.ensureJava = ensureJava;
//# sourceMappingURL=javaRuntimeService.js.map