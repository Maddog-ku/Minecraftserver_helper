<template>
  <section class="page">
    <header class="page__header detail-header">
      <div>
        <h1>ServerDetail</h1>
        <p class="muted">伺服器詳細資訊</p>
      </div>
      <div class="detail-actions">
        <div class="tabs">
          <button
            type="button"
            :class="['tab', activeTab === 'info' && 'active']"
            @click="activeTab = 'info'"
          >
            Info
          </button>
          <button
            type="button"
            :class="['tab', activeTab === 'console' && 'active']"
            @click="activeTab = 'console'"
          >
            Console
          </button>
          <button
            type="button"
            :class="['tab', activeTab === 'mods' && 'active']"
            @click="activeTab = 'mods'"
          >
            Mods
          </button>
        </div>
        <button class="ghost" @click="emit('back')">New Server</button>
      </div>
    </header>

    <div v-if="server">
      <div v-if="activeTab === 'info'" class="detail-grid">
        <div class="detail-card">
          <h2>{{ server.displayName }}</h2>
          <p class="muted">ID: {{ server.id }}</p>
          <div class="detail-row">
            <span>Status</span>
            <strong>{{ server.status }}</strong>
          </div>
          <div class="detail-row">
            <span>Core</span>
            <strong>{{ getCoreTypeLabel(server.coreType) }}</strong>
          </div>
          <div class="detail-row">
            <span>Version</span>
            <strong>{{ server.mcVersion }}</strong>
          </div>
          <div class="detail-row">
            <span>RAM</span>
            <strong>{{ server.ramMinMb }}M / {{ server.ramMaxMb }}M</strong>
          </div>
          <div class="detail-row">
            <span>Path</span>
            <strong class="path">{{ server.serverPath }}</strong>
          </div>
        </div>

        <div class="detail-card accent">
          <h3>Quick Notes</h3>
          <p class="muted">伺服器將在 server/ 目錄下啟動，並讀取 server.jar。</p>
          <p class="muted">Console 日誌會顯示在 Console tab。</p>
        </div>
      </div>

      <div v-else-if="activeTab === 'console'">
        <ConsolePanel
          :logs="logs"
          :status="server.status"
          :busy="busy"
          @start="emit('start')"
          @stop="emit('stop')"
          @send="emit('send-command', $event)"
        />
      </div>

      <div v-else>
        <ModsPanel
          :mods="mods"
          :import-result="importResult"
          :busy="busy"
          @import="emit('import-mods')"
          @import-folder="emit('import-mods-folder', $event)"
          @refresh="emit('refresh-mods')"
          @toggle="emit('toggle-mod', $event)"
          @remove="emit('remove-mod', $event)"
        />
      </div>
    </div>

    <div v-else class="empty">
      <p>尚未選擇伺服器，請先從 Sidebar 選擇。</p>
      <button class="primary" @click="emit('back')">Create Server</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import ConsolePanel from '../components/ConsolePanel.vue';
import ModsPanel from '../components/ModsPanel.vue';
import type { ImportResult, ModInfo, ServerProfile } from '../store/serversStore';
import { getCoreTypeInfo } from '../constants/coreTypes';

const props = defineProps<{
  server: ServerProfile | null;
  logs: string[];
  mods: ModInfo[];
  importResult: ImportResult | null;
  busy: boolean;
}>();

const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'start'): void;
  (event: 'stop'): void;
  (event: 'send-command', command: string): void;
  (event: 'import-mods'): void;
  (event: 'import-mods-folder', options: { includeConfig: boolean; includeKubejs: boolean; includeDefaultconfigs: boolean }): void;
  (event: 'refresh-mods'): void;
  (event: 'toggle-mod', payload: { filename: string; enabled: boolean }): void;
  (event: 'remove-mod', filename: string): void;
}>();

const activeTab = ref<'info' | 'console' | 'mods'>('info');

const getCoreTypeLabel = (value: ServerProfile['coreType']) => getCoreTypeInfo(value).label;

watch(
  () => props.server?.id,
  () => {
    activeTab.value = 'info';
  }
);
</script>
