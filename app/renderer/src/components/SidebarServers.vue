<template>
  <section class="sidebar-servers">
    <div class="sidebar-servers__actions">
      <input
        v-model="query"
        class="search"
        type="text"
        placeholder="Search servers"
      />
      <button class="primary" type="button" @click="emit('create')">+ New</button>
    </div>

    <div class="server-list">
      <button
        v-for="server in filteredServers"
        :key="server.id"
        :class="['server-item', server.id === props.activeId && 'active']"
        type="button"
        @click="emit('select', server.id)"
        @contextmenu.prevent="openMenu($event, server.id)"
      >
        <div class="server-item__title">
          <span class="status" :class="`status--${server.status}`"></span>
          <span>{{ server.displayName }}</span>
        </div>
        <div class="server-item__meta">
          <span>{{ getCoreTypeLabel(server.coreType) }}</span>
          <span>{{ server.mcVersion }}</span>
        </div>
      </button>

      <div v-if="!filteredServers.length" class="server-empty">
        <p class="muted">No servers found.</p>
      </div>
    </div>

    <div
      v-if="menu.visible"
      class="context-menu"
      :style="{ top: `${menu.y}px`, left: `${menu.x}px` }"
    >
      <button type="button" @click="handleRename">Rename</button>
      <button type="button" @click="handleDelete">Delete</button>
      <button type="button" @click="handleOpenFolder">Open Folder</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { ServerProfile } from '../store/serversStore';
import { getCoreTypeInfo } from '../constants/coreTypes';

const props = defineProps<{ servers: ServerProfile[]; activeId: string | null }>();

const emit = defineEmits<{
  (event: 'select', id: string): void;
  (event: 'create'): void;
  (event: 'rename', payload: { id: string; displayName: string }): void;
  (event: 'delete', payload: { id: string; deleteFiles: boolean }): void;
  (event: 'open-folder', id: string): void;
}>();

const query = ref('');

const menu = reactive({
  visible: false,
  x: 0,
  y: 0,
  serverId: ''
});

const filteredServers = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  if (!keyword) return [...props.servers];
  return props.servers.filter((server) =>
    server.displayName.toLowerCase().includes(keyword)
  );
});

const getCoreTypeLabel = (value: ServerProfile['coreType']) => getCoreTypeInfo(value).label;

const closeMenu = () => {
  menu.visible = false;
};

const openMenu = (event: MouseEvent, id: string) => {
  menu.visible = true;
  menu.x = event.clientX;
  menu.y = event.clientY;
  menu.serverId = id;
};

const handleRename = () => {
  const target = props.servers.find((server) => server.id === menu.serverId);
  closeMenu();
  if (!target) return;
  const nextName = window.prompt('Rename server', target.displayName);
  if (!nextName || !nextName.trim()) return;
  emit('rename', { id: target.id, displayName: nextName.trim() });
};

const handleDelete = () => {
  const target = props.servers.find((server) => server.id === menu.serverId);
  closeMenu();
  if (!target) return;
  const confirmDelete = window.confirm(`Delete ${target.displayName}?`);
  if (!confirmDelete) return;
  const deleteFiles = window.confirm('Delete server files too?');
  emit('delete', { id: target.id, deleteFiles });
};

const handleOpenFolder = () => {
  const target = props.servers.find((server) => server.id === menu.serverId);
  closeMenu();
  if (!target) return;
  emit('open-folder', target.id);
};

const onGlobalClick = () => {
  if (menu.visible) {
    closeMenu();
  }
};

const onGlobalKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeMenu();
  }
};

onMounted(() => {
  window.addEventListener('click', onGlobalClick);
  window.addEventListener('keydown', onGlobalKey);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick);
  window.removeEventListener('keydown', onGlobalKey);
});
</script>
