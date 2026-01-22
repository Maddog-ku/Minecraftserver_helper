<template>
  <section class="page">
    <header class="page__header">
      <div>
        <h1>Create Server</h1>
        <p class="muted">建立新的伺服器設定檔</p>
      </div>
      <button class="ghost" type="button" @click="emit('cancel')">Cancel</button>
    </header>

    <form class="form" @submit.prevent="handleSubmit">
      <label class="form__field">
        <span>Name</span>
        <input v-model="form.displayName" type="text" placeholder="Server name" required />
      </label>

      <label class="form__field">
        <span>Core Type</span>
        <select v-model="form.coreType" required>
          <option v-for="core in CORE_TYPES" :key="core.value" :value="core.value">
            {{ core.label }}
          </option>
        </select>
        <p class="muted">{{ selectedCore.desc }}</p>
      </label>

      <label class="form__field">
        <span>Minecraft Version</span>
        <select v-model="form.mcVersion" required>
          <option value="1.20.4">1.20.4</option>
          <option value="1.20.1">1.20.1</option>
          <option value="1.19.4">1.19.4</option>
          <option value="1.18.2">1.18.2</option>
        </select>
      </label>

      <div class="form__actions">
        <button class="primary" type="submit" :disabled="loading">Create</button>
        <button class="ghost" type="button" @click="emit('cancel')">Back</button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { CoreType } from '../store/serversStore';
import { CORE_TYPES, getCoreTypeInfo } from '../constants/coreTypes';

defineProps<{ loading: boolean; error: string | null }>();

const emit = defineEmits<{
  (event: 'create', payload: { displayName: string; coreType: CoreType; mcVersion: string }): void;
  (event: 'cancel'): void;
}>();

const form = reactive({
  displayName: '',
  coreType: 'vanilla' as CoreType,
  mcVersion: '1.20.4'
});

const selectedCore = computed(() => getCoreTypeInfo(form.coreType));

const handleSubmit = () => {
  if (!form.displayName.trim()) return;
  emit('create', {
    displayName: form.displayName.trim(),
    coreType: form.coreType,
    mcVersion: form.mcVersion
  });
};
</script>
