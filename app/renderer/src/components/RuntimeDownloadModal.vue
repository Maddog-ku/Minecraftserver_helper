<template>
  <div v-if="visible" class="modal-backdrop">
    <div class="modal">
      <h3>未偵測到 Java，將自動下載內建 Java（只需一次）。</h3>
      <p class="muted">{{ phaseText }}</p>
      <div class="progress-bar">
        <div class="progress" :style="{ width: `${percent}%` }"></div>
      </div>
      <p v-if="progress && progress.totalBytes" class="muted">
        {{ formatBytes(progress.downloadedBytes) }} / {{ formatBytes(progress.totalBytes) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RuntimeProgress } from '../store/serversStore';

const props = defineProps<{ visible: boolean; progress: RuntimeProgress | null }>();

const percent = computed(() => props.progress?.percent ?? 0);

const phaseText = computed(() => {
  const phase = props.progress?.phase;
  if (phase === 'downloading') return '下載中...';
  if (phase === 'extracting') return '解壓中...';
  if (phase === 'verifying') return '驗證中...';
  return '準備中...';
});

const formatBytes = (value: number) => {
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
};
</script>
