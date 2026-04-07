<script setup lang="ts">
defineProps<{
  height?: string
}>()
</script>

<template>
  <div class="zq-scrollbar" :style="{ maxHeight: height }">
    <slot />
  </div>
</template>

<style scoped>
.zq-scrollbar {
  overflow-y: auto;
  overflow-x: hidden;
  /* margin-right: 8px; */
}

.zq-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.zq-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.zq-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}

.zq-scrollbar:hover::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb, rgba(0, 0, 0, 0.12));
}

.zq-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover, rgba(0, 0, 0, 0.22));
}
</style>
