<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

import { ref } from 'vue';

import { ZqScrollbar } from '@/components/ui';

interface Props {
  editor: Editor;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const activeCategory = ref(0);

const categories = [
  {
    key: 'smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉',
      '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄',
      '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
      '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
      '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮', '😯', '😲',
      '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
      '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
    ],
  },
  {
    key: 'gestures',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌',
      '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛',
      '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '💪', '🦾',
    ],
  },
  {
    key: 'hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
      '💟', '♥️', '💋', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️',
      '💣', '💬',
    ],
  },
  {
    key: 'objects',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🎀', '🏆', '🥇', '🥈', '🥉', '⚽',
      '🏀', '🎯', '🎮', '🎲', '🧩', '🎵', '🎶', '🔔', '📢', '💡',
      '🔥', '⭐', '🌟', '✨', '⚡', '☀️', '🌈', '☁️', '❄️', '🌸',
      '🍀', '🌺',
    ],
  },
  {
    key: 'food',
    icon: '🍕',
    emojis: [
      '🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍰', '🎂', '🍩', '🍪',
      '🍫', '🍬', '🍭', '☕', '🍵', '🧋', '🍺', '🍻', '🥂', '🍷',
      '🍸', '🍹', '🧃', '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓',
      '🫐', '🍑',
    ],
  },
];

function handleSelect(emoji: string) {
  props.editor.chain().focus().insertContent(emoji).run();
  emit('close');
}
</script>

<template>
  <div class="zq-emoji-picker">
    <div class="zq-emoji-picker__tabs">
      <button
        v-for="(cat, idx) in categories"
        :key="cat.key"
        class="zq-emoji-picker__tab"
        :class="{ 'is-active': activeCategory === idx }"
        @click="activeCategory = idx"
      >
        {{ cat.icon }}
      </button>
    </div>
    <ZqScrollbar height="200px">
      <div class="zq-emoji-picker__grid">
        <button
          v-for="emoji in categories[activeCategory]!.emojis"
          :key="emoji"
          class="zq-emoji-picker__item"
          :title="emoji"
          @click="handleSelect(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </ZqScrollbar>
  </div>
</template>

<style scoped>
.zq-emoji-picker {
  width: 320px;
  background: var(--el-bg-color);
  border-radius: 8px;
}

.zq-emoji-picker__tabs {
  display: flex;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.zq-emoji-picker__tab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  padding: 0;
  font-size: 16px;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  outline: none;
  transition: background 0.15s;
}

.zq-emoji-picker__tab:hover {
  background: var(--el-fill-color-light);
}

.zq-emoji-picker__tab.is-active {
  background: var(--el-color-primary-light-9);
}

.zq-emoji-picker__grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  padding: 6px 8px;
}

.zq-emoji-picker__item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  font-size: 20px;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  outline: none;
  transition: all 0.15s;
}

.zq-emoji-picker__item:hover {
  background: var(--el-fill-color-light);
  transform: scale(1.2);
}
</style>
