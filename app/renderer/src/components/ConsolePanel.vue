<template>
  <div class="console">
    <div class="console__header">
      <div class="console__status">
        <span class="status" :class="`status--${status}`"></span>
        <span>{{ status }}</span>
      </div>
      <div class="console__actions">
        <button class="primary" type="button" :disabled="busy || status === 'running'" @click="emit('start')">
          Start
        </button>
        <button class="ghost" type="button" :disabled="busy || status === 'stopped'" @click="emit('stop')">
          Stop
        </button>
      </div>
    </div>

    <div ref="logRef" class="console__body">
      <div v-for="(line, index) in logs" :key="index" class="console__line">
        {{ line }}
      </div>
    </div>

    <div class="console__input">
      <input
        v-model="command"
        type="text"
        placeholder="Type command and press Enter"
        :disabled="status !== 'running' || busy"
        @keydown.enter.prevent="handleSend"
      />
      <button class="primary" type="button" :disabled="!command.trim() || status !== 'running' || busy" @click="handleSend">
        Send
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { ServerStatus } from '../store/serversStore';

const props = defineProps<{ logs: string[]; status: ServerStatus; busy: boolean }>();

const emit = defineEmits<{
  (event: 'start'): void;
  (event: 'stop'): void;
  (event: 'send', command: string): void;
}>();

const command = ref('');
const logRef = ref<HTMLDivElement | null>(null);

const handleSend = () => {
  const value = command.value.trim();
  if (!value) return;
  emit('send', value);
  command.value = '';
};

watch(
  () => props.logs.length,
  async () => {
    await nextTick();
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight;
    }
  }
);
</script>
