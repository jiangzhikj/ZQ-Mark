<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDrawStore } from '../store/draw-store';
import { getElementBounds, getCommonBounds } from '../elements/bounds';
import type { DrawTextElement } from '../types';

const { t } = useI18n();
const store = useDrawStore();
const editInputRef = ref<HTMLInputElement | null>(null);

const show = computed(() => store.showStats && !store.viewModeEnabled);

const totalElements = computed(() => {
  void store.sceneVersion;
  return store.elements.length;
});

const sceneBounds = computed(() => {
  void store.sceneVersion;
  const els = store.elements;
  if (els.length === 0) return { w: 0, h: 0 };
  const [x1, y1, x2, y2] = getCommonBounds(els);
  return { w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
});

const selected = computed(() => store.selectedElements);
const isSingle = computed(() => selected.value.length === 1);
const isMulti = computed(() => selected.value.length > 1);
const hasSelection = computed(() => selected.value.length > 0);

const selBounds = computed(() => {
  if (!hasSelection.value) return null;
  if (isSingle.value) {
    const el = selected.value[0]!;
    const [x1, y1, x2, y2] = getElementBounds(el);
    return {
      x: Math.round(x1 * 100) / 100,
      y: Math.round(y1 * 100) / 100,
      w: Math.round((x2 - x1) * 100) / 100,
      h: Math.round((y2 - y1) * 100) / 100,
    };
  }
  const [x1, y1, x2, y2] = getCommonBounds(selected.value);
  return {
    x: Math.round(x1 * 100) / 100,
    y: Math.round(y1 * 100) / 100,
    w: Math.round((x2 - x1) * 100) / 100,
    h: Math.round((y2 - y1) * 100) / 100,
  };
});

const selAngle = computed(() => {
  if (!isSingle.value) return null;
  const el = selected.value[0]!;
  return Math.round(((el.angle * 180) / Math.PI) * 100) / 100;
});

const isTextSelected = computed(() => {
  return isSingle.value && selected.value[0]?.type === 'text';
});

const selFontSize = computed(() => {
  if (!isTextSelected.value) return null;
  return (selected.value[0] as DrawTextElement).fontSize;
});

const editingField = ref<string | null>(null);
const editValue = ref('');

function startEdit(field: string, currentValue: number | null) {
  if (currentValue === null) return;
  editingField.value = field;
  editValue.value = String(currentValue);
  nextTick(() => {
    const el = editInputRef.value;
    if (Array.isArray(el)) {
      (el[0] as HTMLInputElement | undefined)?.select();
    } else {
      el?.select();
    }
  });
}

function commitEdit() {
  const field = editingField.value;
  if (!field) return;
  const val = Number.parseFloat(editValue.value);
  if (Number.isNaN(val)) {
    editingField.value = null;
    return;
  }

  store.recordHistory();

  if (field === 'x' && selBounds.value) {
    const dx = val - selBounds.value.x;
    for (const el of selected.value) {
      store.updateElement(el.id, { x: el.x + dx } as any);
    }
  } else if (field === 'y' && selBounds.value) {
    const dy = val - selBounds.value.y;
    for (const el of selected.value) {
      store.updateElement(el.id, { y: el.y + dy } as any);
    }
  } else if (field === 'w' && isSingle.value) {
    store.updateElement(selected.value[0]!.id, { width: Math.max(1, val) } as any);
  } else if (field === 'h' && isSingle.value) {
    store.updateElement(selected.value[0]!.id, { height: Math.max(1, val) } as any);
  } else if (field === 'a' && isSingle.value) {
    const radians = (val * Math.PI) / 180;
    store.updateElement(selected.value[0]!.id, { angle: radians } as any);
  } else if (field === 'f' && isTextSelected.value) {
    store.updateElement(selected.value[0]!.id, { fontSize: Math.max(4, val) } as any);
  }

  store.requestRender();
  editingField.value = null;
}

function onInputKeydown(e: KeyboardEvent) {
  e.stopPropagation();
  if (e.key === 'Enter') {
    e.preventDefault();
    commitEdit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    editingField.value = null;
  }
}
</script>

<template>
  <div
    v-if="show"
    class="absolute bottom-14 right-3 z-20 min-w-44 rounded-lg border border-border bg-card p-2.5 text-xs shadow-md"
  >
    <div class="mb-2 flex items-center justify-between">
      <span class="font-medium text-foreground">{{ t('draw.stats.title') }}</span>
      <button
        class="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
        @click="store.showStats = false"
      >
        &times;
      </button>
    </div>

    <div class="mb-1.5 text-muted-foreground">
      {{ t('draw.stats.elements') }}: {{ totalElements }}
    </div>
    <div class="mb-2 text-muted-foreground">
      {{ t('draw.stats.sceneSize') }}: {{ sceneBounds.w }} &times; {{ sceneBounds.h }}
    </div>

    <template v-if="hasSelection && selBounds">
      <div class="mb-1.5 border-t border-border pt-1.5 font-medium text-foreground">
        {{ isMulti ? t('draw.stats.multiSelected', { count: selected.length }) : selected[0]?.type }}
      </div>

      <div class="grid grid-cols-2 gap-x-3 gap-y-1">
        <div
          v-for="item in [
            { label: 'X', field: 'x', value: selBounds.x, editable: true },
            { label: 'Y', field: 'y', value: selBounds.y, editable: true },
            { label: 'W', field: 'w', value: selBounds.w, editable: isSingle },
            { label: 'H', field: 'h', value: selBounds.h, editable: isSingle },
          ]"
          :key="item.field"
          class="flex items-center gap-1"
        >
          <span class="w-4 font-medium text-muted-foreground">{{ item.label }}</span>
          <input
            v-if="editingField === item.field"
            ref="editInputRef"
            v-model="editValue"
            class="h-5 w-full rounded border border-primary bg-background px-1 text-xs text-foreground outline-none"
            @blur="commitEdit"
            @keydown="onInputKeydown"
          />
          <button
            v-else
            class="h-5 w-full truncate rounded px-1 text-left text-foreground"
            :class="item.editable ? 'hover:bg-accent cursor-pointer' : 'opacity-60 cursor-default'"
            @click="item.editable && startEdit(item.field, item.value)"
          >
            {{ item.value }}
          </button>
        </div>
      </div>

      <div v-if="isSingle && selAngle !== null" class="mt-1 flex items-center gap-1">
        <span class="w-4 font-medium text-muted-foreground">A</span>
        <input
          v-if="editingField === 'a'"
          ref="editInputRef"
          v-model="editValue"
          class="h-5 w-full rounded border border-primary bg-background px-1 text-xs text-foreground outline-none"
          @blur="commitEdit"
          @keydown="onInputKeydown"
        />
        <button
          v-else
          class="h-5 w-full truncate rounded px-1 text-left text-foreground hover:bg-accent"
          @click="startEdit('a', selAngle)"
        >
          {{ selAngle }}&deg;
        </button>
      </div>

      <div v-if="isTextSelected && selFontSize !== null" class="mt-1 flex items-center gap-1">
        <span class="w-4 font-medium text-muted-foreground">F</span>
        <input
          v-if="editingField === 'f'"
          ref="editInputRef"
          v-model="editValue"
          class="h-5 w-full rounded border border-primary bg-background px-1 text-xs text-foreground outline-none"
          @blur="commitEdit"
          @keydown="onInputKeydown"
        />
        <button
          v-else
          class="h-5 w-full truncate rounded px-1 text-left text-foreground hover:bg-accent"
          @click="startEdit('f', selFontSize)"
        >
          {{ selFontSize }}
        </button>
      </div>
    </template>
  </div>
</template>
