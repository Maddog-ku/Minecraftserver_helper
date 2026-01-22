<template>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand__mark">⛏️</span>
        <div>
          <p class="brand__title">Minecraft</p>
          <p class="brand__subtitle">Server Helper</p>
        </div>
      </div>

      <SidebarServers
        :servers="store.servers"
        :active-id="store.selectedId"
        @select="handleSelect"
        @create="openCreate"
        @rename="handleRename"
        @delete="handleDelete"
        @open-folder="handleOpenFolder"
      />

      <div class="sidebar__card">
        <p class="muted">Total servers</p>
        <h3>{{ store.servers.length }}</h3>
        <span class="pill">{{ onlineCount }} running</span>
      </div>

      <div class="sidebar__footer">
        <p class="muted">Secure mode</p>
        <span class="pill">contextIsolation: on</span>
      </div>
    </aside>

    <main class="panel">
      <RuntimeDownloadModal
        :visible="store.runtimeModalVisible"
        :progress="store.runtimeProgress"
      />

      <div v-if="store.error" class="alert">
        {{ store.error }}
        <button class="ghost" @click="store.setError(null)">Dismiss</button>
      </div>

      <CreateWizard
        v-if="activeView === 'create'"
        :loading="store.loading"
        :error="store.error"
        @create="handleCreate"
        @cancel="activeView = 'detail'"
      />

      <ServerDetail
        v-else
        :server="store.selectedServer"
        :logs="activeLogs"
        :mods="activeMods"
        :import-result="activeImportResult"
        :busy="store.loading"
        @back="openCreate"
        @start="handleStart"
        @stop="handleStop"
        @send-command="handleSendCommand"
        @import-mods="handleImportMods"
        @import-mods-folder="handleImportModsFolder"
        @refresh-mods="handleRefreshMods"
        @toggle-mod="handleToggleMod"
        @remove-mod="handleRemoveMod"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import SidebarServers from './components/SidebarServers.vue';
import CreateWizard from './pages/CreateWizard.vue';
import ServerDetail from './pages/ServerDetail.vue';
import RuntimeDownloadModal from './components/RuntimeDownloadModal.vue';
import { useServersStore } from './store/serversStore';
import type { CoreType } from './store/serversStore';

const store = useServersStore();
const activeView = ref<'detail' | 'create'>('detail');

const onlineCount = computed(
  () => store.servers.filter((server) => server.status === 'running').length
);

const activeLogs = computed(() => {
  if (!store.selectedId) return [];
  return store.logs[store.selectedId] ?? [];
});

const activeMods = computed(() => {
  if (!store.selectedId) return [];
  return store.mods[store.selectedId] ?? [];
});

const activeImportResult = computed(() => {
  if (!store.selectedId) return null;
  return store.importResults[store.selectedId] ?? null;
});

const openCreate = () => {
  activeView.value = 'create';
  store.setError(null);
};

const handleSelect = (id: string) => {
  store.selectedId = id;
  activeView.value = 'detail';
};

const handleCreate = async (payload: { displayName: string; coreType: CoreType; mcVersion: string }) => {
  const created = await store.createServer(payload);
  if (created) {
    activeView.value = 'detail';
  }
};

const handleRename = async (payload: { id: string; displayName: string }) => {
  if (!payload.displayName.trim()) return;
  await store.renameServer(payload);
};

const handleDelete = async (payload: { id: string; deleteFiles: boolean }) => {
  const target = store.servers.find((server) => server.id === payload.id);
  if (target?.status === 'running') {
    store.setError('Server is running. Please stop it before deleting.');
    return;
  }
  await store.deleteServer(payload);
};

const handleOpenFolder = async (id: string) => {
  await store.openFolder(id);
};

const handleStart = async () => {
  if (store.selectedId) {
    await store.startServer(store.selectedId);
  }
};

const handleStop = async () => {
  if (store.selectedId) {
    await store.stopServer(store.selectedId);
  }
};

const handleSendCommand = async (command: string) => {
  if (store.selectedId) {
    await store.sendCommand(store.selectedId, command);
  }
};

const handleImportMods = async () => {
  if (store.selectedId) {
    await store.importMods(store.selectedId);
  }
};

const handleImportModsFolder = async (options: { includeConfig: boolean; includeKubejs: boolean; includeDefaultconfigs: boolean }) => {
  if (store.selectedId) {
    await store.importModsFromFolder(store.selectedId, options);
  }
};

const handleRefreshMods = async () => {
  if (store.selectedId) {
    await store.loadMods(store.selectedId);
  }
};

const handleToggleMod = async (payload: { filename: string; enabled: boolean }) => {
  if (store.selectedId) {
    await store.toggleMod(store.selectedId, payload.filename, payload.enabled);
  }
};

const handleRemoveMod = async (filename: string) => {
  if (store.selectedId) {
    await store.removeMod(store.selectedId, filename);
  }
};

onMounted(() => {
  store.loadServers();
  store.subscribeLogs();
  store.subscribeRuntime();
});

onUnmounted(() => {
  store.unsubscribeLogs();
  store.unsubscribeRuntime();
});

watch(
  () => store.selectedId,
  (id) => {
    if (id) {
      store.loadMods(id);
    }
  },
  { immediate: true }
);
</script>
