<template>
  <section class="page">
    <header class="page__header">
      <div>
        <h1>Home</h1>
        <p class="muted">伺服器列表</p>
      </div>
      <span class="badge">{{ servers.length }} servers</span>
    </header>

    <div class="server-grid">
      <article v-for="server in servers" :key="server.id" class="card">
        <div class="card__title">
          <span class="status" :class="`status--${server.status}`"></span>
          <h3>{{ server.displayName }}</h3>
        </div>
        <div class="meta">
          <span>{{ getCoreTypeLabel(server.coreType) }}</span>
          <span>{{ server.mcVersion }}</span>
        </div>
        <div class="meta">
          <span>{{ server.serverPath }}</span>
        </div>
        <button class="primary" @click="emit('open-detail', server.id)">Open</button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ServerProfile } from '../store/serversStore';
import { getCoreTypeInfo } from '../constants/coreTypes';

defineProps<{ servers: ServerProfile[] }>();

const emit = defineEmits<{
  (event: 'open-detail', id: string): void;
}>();

const getCoreTypeLabel = (value: ServerProfile['coreType']) => getCoreTypeInfo(value).label;
</script>
