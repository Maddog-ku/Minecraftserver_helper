import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { getServerById } from '../storage/registryStore';

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

const ensureModsDir = async (serverId: string) => {
  const server = await getServerById(serverId);
  const modsPath = path.join(server.serverPath, 'mods');
  await fs.mkdir(modsPath, { recursive: true });
  return { server, modsPath };
};

const isJar = (filePath: string) => filePath.toLowerCase().endsWith('.jar');
const isZip = (filePath: string) => filePath.toLowerCase().endsWith('.zip');

const findJarFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findJarFiles(entryPath)));
    } else if (entry.isFile() && isJar(entry.name)) {
      results.push(entryPath);
    }
  }
  return results;
};

const hasConflict = async (modsPath: string, filename: string) => {
  const direct = path.join(modsPath, filename);
  const disabled = `${direct}.disabled`;
  try {
    await fs.access(direct);
    return true;
  } catch {
    // ignore
  }
  try {
    await fs.access(disabled);
    return true;
  } catch {
    return false;
  }
};

const copyJar = async (modsPath: string, jarPath: string) => {
  const filename = path.basename(jarPath);
  const target = path.join(modsPath, filename);
  await fs.copyFile(jarPath, target);
  return filename;
};

const fileExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const copyDirectory = async (
  srcRoot: string,
  destRoot: string,
  options: { skipOnConflict: boolean; conflicts: Set<string> }
) => {
  let filesCopied = 0;
  let jarsCopied = 0;

  const walk = async (currentSrc: string) => {
    const entries = await fs.readdir(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      const entrySrc = path.join(currentSrc, entry.name);
      const relative = path.relative(srcRoot, entrySrc);
      const entryDest = path.join(destRoot, relative);

      if (entry.isDirectory()) {
        await fs.mkdir(entryDest, { recursive: true });
        await walk(entrySrc);
        continue;
      }

      if (!entry.isFile()) continue;

      const exists = await fileExists(entryDest);
      if (exists) {
        options.conflicts.add(relative);
        if (options.skipOnConflict) {
          continue;
        }
      }

      await fs.mkdir(path.dirname(entryDest), { recursive: true });
      await fs.copyFile(entrySrc, entryDest);
      filesCopied += 1;
      if (entry.name.toLowerCase().endsWith('.jar')) {
        jarsCopied += 1;
      }
    }
  };

  await walk(srcRoot);
  return { filesCopied, jarsCopied };
};

const extractZipToTemp = async (zipPath: string) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'msh-mods-'));
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(tempRoot, true);
  return tempRoot;
};

const detectCurseForge = (zipPath: string) => {
  try {
    const zip = new AdmZip(zipPath);
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) return null;
    const content = manifestEntry.getData().toString('utf-8');
    const manifest = JSON.parse(content) as {
      minecraft?: { version?: string; modLoaders?: { id: string }[] };
      files?: unknown[];
    };

    const mcVersion = manifest.minecraft?.version ?? '';
    const loaderId = manifest.minecraft?.modLoaders?.[0]?.id ?? '';
    let loaderType: 'forge' | 'fabric' | 'neoforge' | 'unknown' = 'unknown';
    if (loaderId.startsWith('forge')) loaderType = 'forge';
    if (loaderId.startsWith('fabric')) loaderType = 'fabric';
    if (loaderId.startsWith('neoforge')) loaderType = 'neoforge';

    return {
      mcVersion,
      loaderType,
      modCount: Array.isArray(manifest.files) ? manifest.files.length : 0
    };
  } catch {
    return null;
  }
};

export const pickAndImportMods = async (serverId: string, filePaths: string[]): Promise<ImportResult> => {
  const { modsPath, server } = await ensureModsDir(serverId);
  const conflicts = new Set<string>();
  let importedJarsCount = 0;
  let importedOverridesCount = 0;
  let skippedCount = 0;
  let detectedPack: ImportResult | null = null;

  for (const filePath of filePaths) {
    if (isJar(filePath)) {
      const filename = path.basename(filePath);
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

          const overridesDir = path.join(tempRoot, 'overrides');
          try {
            const stat = await fs.stat(overridesDir);
            if (stat.isDirectory()) {
              const { filesCopied, jarsCopied } = await copyDirectory(overridesDir, server.serverPath, {
                skipOnConflict: false,
                conflicts
              });
              importedOverridesCount += filesCopied - jarsCopied;
              importedJarsCount += jarsCopied;
            }
          } catch {
            // no overrides
          }
          continue;
        }

        const modsDir = path.join(tempRoot, 'mods');
        let jarFiles: string[] = [];
        try {
          const stat = await fs.stat(modsDir);
          if (stat.isDirectory()) {
            jarFiles = await findJarFiles(modsDir);
          }
        } catch {
          jarFiles = await findJarFiles(tempRoot);
        }

        for (const jarPath of jarFiles) {
          const filename = path.basename(jarPath);
          if (await hasConflict(modsPath, filename)) {
            conflicts.add(filename);
            skippedCount += 1;
            continue;
          }
          await copyJar(modsPath, jarPath);
          importedJarsCount += 1;
        }
      } finally {
        await fs.rm(tempRoot, { recursive: true, force: true });
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

export const listMods = async (serverId: string): Promise<ModInfo[]> => {
  const { modsPath } = await ensureModsDir(serverId);
  const entries = await fs.readdir(modsPath, { withFileTypes: true });
  const mods: ModInfo[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filename = entry.name;
    if (!filename.endsWith('.jar') && !filename.endsWith('.jar.disabled')) continue;
    const fullPath = path.join(modsPath, filename);
    const stat = await fs.stat(fullPath);
    mods.push({
      filename,
      size: stat.size,
      enabled: !filename.endsWith('.disabled')
    });
  }

  return mods.sort((a, b) => a.filename.localeCompare(b.filename));
};

export const removeMod = async (serverId: string, filename: string) => {
  const { modsPath } = await ensureModsDir(serverId);
  const target = path.join(modsPath, filename);
  await fs.rm(target, { force: true });
};

export const toggleMod = async (serverId: string, filename: string, enabled: boolean) => {
  const { modsPath } = await ensureModsDir(serverId);
  const currentPath = path.join(modsPath, filename);

  if (enabled) {
    if (!filename.endsWith('.disabled')) return;
    const nextName = filename.replace(/\.disabled$/, '');
    const nextPath = path.join(modsPath, nextName);
    await fs.rename(currentPath, nextPath);
  } else {
    if (filename.endsWith('.disabled')) return;
    const nextPath = `${currentPath}.disabled`;
    await fs.rename(currentPath, nextPath);
  }
};

export const importFromFolder = async (
  serverId: string,
  folderPath: string,
  options: FolderImportOptions
): Promise<ImportResult> => {
  const { server, modsPath } = await ensureModsDir(serverId);
  const conflicts = new Set<string>();
  let importedJarsCount = 0;
  let importedOverridesCount = 0;

  const modsSource = path.join(folderPath, 'mods');
  try {
    const stat = await fs.stat(modsSource);
    if (stat.isDirectory()) {
      const { filesCopied, jarsCopied } = await copyDirectory(modsSource, modsPath, {
        skipOnConflict: true,
        conflicts
      });
      importedJarsCount += jarsCopied;
      importedOverridesCount += filesCopied - jarsCopied;
    }
  } catch {
    // no mods folder
  }

  const copyOptional = async (dirName: string) => {
    const source = path.join(folderPath, dirName);
    const dest = path.join(server.serverPath, dirName);
    try {
      const stat = await fs.stat(source);
      if (stat.isDirectory()) {
        const { filesCopied, jarsCopied } = await copyDirectory(source, dest, {
          skipOnConflict: false,
          conflicts
        });
        importedOverridesCount += filesCopied - jarsCopied;
        importedJarsCount += jarsCopied;
      }
    } catch {
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
