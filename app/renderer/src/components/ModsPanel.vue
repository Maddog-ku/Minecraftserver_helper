<template>
  <section class="mods">
    <div class="mods__header">
      <div>
        <h3>Mods</h3>
        <p class="muted">Manage server mods (.jar)</p>
      </div>
      <div class="mods__actions">
        <button class="primary" type="button" :disabled="busy" @click="emit('import')">
          Import Mods
        </button>
        <button class="ghost" type="button" :disabled="busy" @click="emit('import-folder', { ...folderOptions })">
          Import from Folder
        </button>
        <button class="ghost" type="button" :disabled="busy" @click="emit('refresh')">
          Refresh
        </button>
      </div>
    </div>

    <div class="mods__options">
      <label class="checkbox">
        <input type="checkbox" v-model="folderOptions.includeConfig" />
        <span>config/</span>
      </label>
      <label class="checkbox">
        <input type="checkbox" v-model="folderOptions.includeKubejs" />
        <span>kubejs/</span>
      </label>
      <label class="checkbox">
        <input type="checkbox" v-model="folderOptions.includeDefaultconfigs" />
        <span>defaultconfigs/</span>
      </label>
    </div>

    <div v-if="importResult" class="mods__result">
      <p>
        Imported {{ importResult.importedCount }} , skipped {{ importResult.skippedCount }}
      </p>
      <p v-if="importResult.importedOverridesCount !== undefined" class="muted">
        Overrides: {{ importResult.importedOverridesCount }} files
      </p>
      <p v-if="importResult.importedJarsCount !== undefined" class="muted">
        Jars: {{ importResult.importedJarsCount }}
      </p>
      <div v-if="importResult.conflicts.length" class="mods__conflicts">
        <p>Conflicts (skipped or overwritten):</p>
        <div class="mods__conflict-list">
          <span v-for="name in importResult.conflicts" :key="name" class="badge">
            {{ name }}
          </span>
        </div>
      </div>
      <div v-if="importResult.detectedPackType === 'curseforge'" class="mods__pack">
        <p>
          Detected CurseForge modpack — Minecraft {{ importResult.mcVersion || '-' }},
          loader: {{ importResult.loaderType || '-' }}, mods: {{ importResult.modCount ?? 0 }}
        </p>
        <p class="muted">
          CurseForge 匯出包通常不包含 mods，已匯入 overrides。你可以：
          A) 匯入已安裝的 CurseForge instance 資料夾（copy mods/config）
          B) 手動匯入 mods jar/zip
        </p>
      </div>
    </div>

    <div v-if="!mods.length" class="empty">
      <p>尚未匯入 mods。</p>
    </div>

    <div v-else class="mods__list">
      <div v-for="mod in mods" :key="mod.filename" class="mods__row">
        <div class="mods__info">
          <strong>{{ mod.filename }}</strong>
          <span class="muted">{{ formatSize(mod.size) }}</span>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            :checked="mod.enabled"
            :disabled="busy"
            @change="emit('toggle', { filename: mod.filename, enabled: !mod.enabled })"
          />
          <span class="slider"></span>
        </label>
        <button class="ghost small" type="button" :disabled="busy" @click="emit('remove', mod.filename)">
          Remove
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import type { FolderImportOptions, ImportResult, ModInfo } from '../store/serversStore';

defineProps<{ mods: ModInfo[]; importResult: ImportResult | null; busy: boolean }>();

const emit = defineEmits<{
  (event: 'import'): void;
  (event: 'import-folder', options: FolderImportOptions): void;
  (event: 'refresh'): void;
  (event: 'toggle', payload: { filename: string; enabled: boolean }): void;
  (event: 'remove', filename: string): void;
}>();

const folderOptions = reactive<FolderImportOptions>({
  includeConfig: true,
  includeKubejs: true,
  includeDefaultconfigs: true
});

const formatSize = (size: number) => {
  if (size > 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  if (size > 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
};
</script>
