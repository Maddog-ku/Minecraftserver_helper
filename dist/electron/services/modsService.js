"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importFromFolder = exports.toggleMod = exports.removeMod = exports.listMods = exports.pickAndImportMods = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const registryStore_1 = require("../storage/registryStore");
const ensureModsDir = async (serverId) => {
    const server = await (0, registryStore_1.getServerById)(serverId);
    const modsPath = path_1.default.join(server.serverPath, 'mods');
    await promises_1.default.mkdir(modsPath, { recursive: true });
    return { server, modsPath };
};
const isJar = (filePath) => filePath.toLowerCase().endsWith('.jar');
const isZip = (filePath) => filePath.toLowerCase().endsWith('.zip');
const findJarFiles = async (dir) => {
    const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        const entryPath = path_1.default.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...(await findJarFiles(entryPath)));
        }
        else if (entry.isFile() && isJar(entry.name)) {
            results.push(entryPath);
        }
    }
    return results;
};
const hasConflict = async (modsPath, filename) => {
    const direct = path_1.default.join(modsPath, filename);
    const disabled = `${direct}.disabled`;
    try {
        await promises_1.default.access(direct);
        return true;
    }
    catch {
        // ignore
    }
    try {
        await promises_1.default.access(disabled);
        return true;
    }
    catch {
        return false;
    }
};
const copyJar = async (modsPath, jarPath) => {
    const filename = path_1.default.basename(jarPath);
    const target = path_1.default.join(modsPath, filename);
    await promises_1.default.copyFile(jarPath, target);
    return filename;
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
const copyDirectory = async (srcRoot, destRoot, options) => {
    let filesCopied = 0;
    let jarsCopied = 0;
    const walk = async (currentSrc) => {
        const entries = await promises_1.default.readdir(currentSrc, { withFileTypes: true });
        for (const entry of entries) {
            const entrySrc = path_1.default.join(currentSrc, entry.name);
            const relative = path_1.default.relative(srcRoot, entrySrc);
            const entryDest = path_1.default.join(destRoot, relative);
            if (entry.isDirectory()) {
                await promises_1.default.mkdir(entryDest, { recursive: true });
                await walk(entrySrc);
                continue;
            }
            if (!entry.isFile())
                continue;
            const exists = await fileExists(entryDest);
            if (exists) {
                options.conflicts.add(relative);
                if (options.skipOnConflict) {
                    continue;
                }
            }
            await promises_1.default.mkdir(path_1.default.dirname(entryDest), { recursive: true });
            await promises_1.default.copyFile(entrySrc, entryDest);
            filesCopied += 1;
            if (entry.name.toLowerCase().endsWith('.jar')) {
                jarsCopied += 1;
            }
        }
    };
    await walk(srcRoot);
    return { filesCopied, jarsCopied };
};
const extractZipToTemp = async (zipPath) => {
    const tempRoot = await promises_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), 'msh-mods-'));
    const zip = new adm_zip_1.default(zipPath);
    zip.extractAllTo(tempRoot, true);
    return tempRoot;
};
const detectCurseForge = (zipPath) => {
    try {
        const zip = new adm_zip_1.default(zipPath);
        const manifestEntry = zip.getEntry('manifest.json');
        if (!manifestEntry)
            return null;
        const content = manifestEntry.getData().toString('utf-8');
        const manifest = JSON.parse(content);
        const mcVersion = manifest.minecraft?.version ?? '';
        const loaderId = manifest.minecraft?.modLoaders?.[0]?.id ?? '';
        let loaderType = 'unknown';
        if (loaderId.startsWith('forge'))
            loaderType = 'forge';
        if (loaderId.startsWith('fabric'))
            loaderType = 'fabric';
        if (loaderId.startsWith('neoforge'))
            loaderType = 'neoforge';
        return {
            mcVersion,
            loaderType,
            modCount: Array.isArray(manifest.files) ? manifest.files.length : 0
        };
    }
    catch {
        return null;
    }
};
const pickAndImportMods = async (serverId, filePaths) => {
    const { modsPath, server } = await ensureModsDir(serverId);
    const conflicts = new Set();
    let importedJarsCount = 0;
    let importedOverridesCount = 0;
    let skippedCount = 0;
    let detectedPack = null;
    for (const filePath of filePaths) {
        if (isJar(filePath)) {
            const filename = path_1.default.basename(filePath);
            if (await hasConflict(modsPath, filename)) {
                conflicts.add(filename);
                skippedCount += 1;
                continue;
            }
            await copyJar(modsPath, filePath);
            importedJarsCount += 1;
            continue;
        }
        if (isZip(filePath)) {
            const curseForgeInfo = detectCurseForge(filePath);
            const tempRoot = await extractZipToTemp(filePath);
            try {
                if (curseForgeInfo) {
                    if (!detectedPack) {
                        detectedPack = {
                            importedCount: 0,
                            skippedCount: 0,
                            conflicts: [],
                            detectedPackType: 'curseforge',
                            mcVersion: curseForgeInfo.mcVersion,
                            loaderType: curseForgeInfo.loaderType,
                            modCount: curseForgeInfo.modCount
                        };
                    }
                    const overridesDir = path_1.default.join(tempRoot, 'overrides');
                    try {
                        const stat = await promises_1.default.stat(overridesDir);
                        if (stat.isDirectory()) {
                            const { filesCopied, jarsCopied } = await copyDirectory(overridesDir, server.serverPath, {
                                skipOnConflict: false,
                                conflicts
                            });
                            importedOverridesCount += filesCopied - jarsCopied;
                            importedJarsCount += jarsCopied;
                        }
                    }
                    catch {
                        // no overrides
                    }
                    continue;
                }
                const modsDir = path_1.default.join(tempRoot, 'mods');
                let jarFiles = [];
                try {
                    const stat = await promises_1.default.stat(modsDir);
                    if (stat.isDirectory()) {
                        jarFiles = await findJarFiles(modsDir);
                    }
                }
                catch {
                    jarFiles = await findJarFiles(tempRoot);
                }
                for (const jarPath of jarFiles) {
                    const filename = path_1.default.basename(jarPath);
                    if (await hasConflict(modsPath, filename)) {
                        conflicts.add(filename);
                        skippedCount += 1;
                        continue;
                    }
                    await copyJar(modsPath, jarPath);
                    importedJarsCount += 1;
                }
            }
            finally {
                await promises_1.default.rm(tempRoot, { recursive: true, force: true });
            }
        }
    }
    const importedCount = importedJarsCount + importedOverridesCount;
    return {
        importedCount,
        skippedCount,
        conflicts: Array.from(conflicts),
        detectedPackType: detectedPack?.detectedPackType,
        mcVersion: detectedPack?.mcVersion,
        loaderType: detectedPack?.loaderType,
        modCount: detectedPack?.modCount,
        importedOverridesCount,
        importedJarsCount
    };
};
exports.pickAndImportMods = pickAndImportMods;
const listMods = async (serverId) => {
    const { modsPath } = await ensureModsDir(serverId);
    const entries = await promises_1.default.readdir(modsPath, { withFileTypes: true });
    const mods = [];
    for (const entry of entries) {
        if (!entry.isFile())
            continue;
        const filename = entry.name;
        if (!filename.endsWith('.jar') && !filename.endsWith('.jar.disabled'))
            continue;
        const fullPath = path_1.default.join(modsPath, filename);
        const stat = await promises_1.default.stat(fullPath);
        mods.push({
            filename,
            size: stat.size,
            enabled: !filename.endsWith('.disabled')
        });
    }
    return mods.sort((a, b) => a.filename.localeCompare(b.filename));
};
exports.listMods = listMods;
const removeMod = async (serverId, filename) => {
    const { modsPath } = await ensureModsDir(serverId);
    const target = path_1.default.join(modsPath, filename);
    await promises_1.default.rm(target, { force: true });
};
exports.removeMod = removeMod;
const toggleMod = async (serverId, filename, enabled) => {
    const { modsPath } = await ensureModsDir(serverId);
    const currentPath = path_1.default.join(modsPath, filename);
    if (enabled) {
        if (!filename.endsWith('.disabled'))
            return;
        const nextName = filename.replace(/\.disabled$/, '');
        const nextPath = path_1.default.join(modsPath, nextName);
        await promises_1.default.rename(currentPath, nextPath);
    }
    else {
        if (filename.endsWith('.disabled'))
            return;
        const nextPath = `${currentPath}.disabled`;
        await promises_1.default.rename(currentPath, nextPath);
    }
};
exports.toggleMod = toggleMod;
const importFromFolder = async (serverId, folderPath, options) => {
    const { server, modsPath } = await ensureModsDir(serverId);
    const conflicts = new Set();
    let importedJarsCount = 0;
    let importedOverridesCount = 0;
    const modsSource = path_1.default.join(folderPath, 'mods');
    try {
        const stat = await promises_1.default.stat(modsSource);
        if (stat.isDirectory()) {
            const { filesCopied, jarsCopied } = await copyDirectory(modsSource, modsPath, {
                skipOnConflict: true,
                conflicts
            });
            importedJarsCount += jarsCopied;
            importedOverridesCount += filesCopied - jarsCopied;
        }
    }
    catch {
        // no mods folder
    }
    const copyOptional = async (dirName) => {
        const source = path_1.default.join(folderPath, dirName);
        const dest = path_1.default.join(server.serverPath, dirName);
        try {
            const stat = await promises_1.default.stat(source);
            if (stat.isDirectory()) {
                const { filesCopied, jarsCopied } = await copyDirectory(source, dest, {
                    skipOnConflict: false,
                    conflicts
                });
                importedOverridesCount += filesCopied - jarsCopied;
                importedJarsCount += jarsCopied;
            }
        }
        catch {
            // ignore
        }
    };
    if (options.includeConfig) {
        await copyOptional('config');
    }
    if (options.includeKubejs) {
        await copyOptional('kubejs');
    }
    if (options.includeDefaultconfigs) {
        await copyOptional('defaultconfigs');
    }
    return {
        importedCount: importedJarsCount + importedOverridesCount,
        skippedCount: 0,
        conflicts: Array.from(conflicts),
        importedOverridesCount,
        importedJarsCount
    };
};
exports.importFromFolder = importFromFolder;
//# sourceMappingURL=modsService.js.map