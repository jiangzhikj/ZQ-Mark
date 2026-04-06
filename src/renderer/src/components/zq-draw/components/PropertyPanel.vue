<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ZqSlider from '@/components/ui/ZqSlider.vue';
import {
  Link,
  Minus as MinusIcon,
  Plus as PlusIcon,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Trash2,
} from '@/components/icons';
import { useDrawStore } from '../store/draw-store';
import type {
  FillStyle,
  StrokeStyle,
  Arrowhead,
  DrawLinearElement,
  DrawArrowElement,
  DrawTextElement,
  TextAlign,
  VerticalAlign,
} from '../types';
import {
  PRESET_STROKE_COLORS,
  PRESET_BACKGROUND_COLORS,
  FONT_FAMILY,
  FONT_METADATA,
  ROUNDNESS,
} from '../constants';
import {
  FillHachureIcon,
  FillCrossHatchIcon,
  FillSolidIcon,
  FillZigZagIcon,
  StrokeWidthThinIcon,
  StrokeWidthBoldIcon,
  StrokeWidthExtraBoldIcon,
  StrokeStyleSolidIcon,
  StrokeStyleDashedIcon,
  StrokeStyleDottedIcon,
  SloppinessArchitectIcon,
  SloppinessArtistIcon,
  SloppinessCartoonistIcon,
  EdgeSharpIcon,
  EdgeRoundIcon,
  ArrowTypeSharpIcon,
  ArrowTypeRoundIcon,
  ArrowTypeElbowIcon,
  ArrowheadNoneIcon,
  ArrowheadArrowIcon,
  ArrowheadTriangleIcon,
  ArrowheadBarIcon,
  ArrowheadCircleIcon,
  ArrowheadDiamondIcon,
  ArrowheadArrowStartIcon,
  ArrowheadTriangleStartIcon,
  ArrowheadBarStartIcon,
  ArrowheadCircleStartIcon,
  ArrowheadDiamondStartIcon,
  ArrowheadNoneStartIcon,
  FontHandDrawnIcon,
  FontNormalIcon,
  FontCodeIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  VerticalAlignTopIcon,
  VerticalAlignMiddleIcon,
  VerticalAlignBottomIcon,
} from './icons/property-icons';
import {
  redrawTextBoundingBox,
  getContainerElement,
  getBoundTextElement,
} from '../elements/bound-text';

const { t } = useI18n();
const store = useDrawStore();

const strokeColorInputRef = ref<HTMLInputElement | null>(null);
const bgColorInputRef = ref<HTMLInputElement | null>(null);

function openStrokeColorPicker() {
  strokeColorInputRef.value?.click();
}
function onStrokeColorInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  if (val) strokeColor.value = val;
}
function openBgColorPicker() {
  bgColorInputRef.value?.click();
}
function onBgColorInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  if (val) backgroundColor.value = val;
}

const isDrawingTool = computed(() => {
  const t = store.activeTool.type;
  return ['rectangle', 'ellipse', 'diamond', 'freedraw', 'arrow', 'line'].includes(t);
});

const showPanel = computed(() => {
  return !store.viewModeEnabled && !store.mainMenuOpen && (store.selectedElements.length > 0 || isDrawingTool.value);
});

const isSingleSelect = computed(() => store.selectedElements.length === 1);
const isMultiSelect = computed(() => store.selectedElements.length > 1);

const primaryElement = computed(() => {
  if (store.selectedElements.length === 0) return null;
  return store.selectedElements[0]!;
});

const activeToolType = computed(() => store.activeTool.type);

const effectiveType = computed(() => {
  if (primaryElement.value) return primaryElement.value.type;
  if (isDrawingTool.value) return activeToolType.value;
  return null;
});

const hasStrokeColor = computed(() => {
  if (!effectiveType.value) return false;
  return ['rectangle', 'ellipse', 'diamond', 'freedraw', 'arrow', 'line', 'text'].includes(effectiveType.value);
});

const hasBackground = computed(() => {
  if (!effectiveType.value) return false;
  return ['rectangle', 'ellipse', 'diamond', 'line', 'freedraw'].includes(effectiveType.value);
});

const showFillStyle = computed(() => {
  if (!hasBackground.value) return false;
  if (primaryElement.value) return primaryElement.value.backgroundColor !== 'transparent';
  return store.currentItemBackgroundColor !== 'transparent';
});

const hasStrokeWidth = computed(() => {
  if (!effectiveType.value) return false;
  return ['rectangle', 'ellipse', 'diamond', 'freedraw', 'arrow', 'line'].includes(effectiveType.value);
});

const hasStrokeStyle = computed(() => {
  if (!effectiveType.value) return false;
  return ['rectangle', 'ellipse', 'diamond', 'arrow', 'line'].includes(effectiveType.value);
});

const canChangeRoundness = computed(() => {
  if (!effectiveType.value) return false;
  return ['rectangle', 'diamond', 'line', 'arrow', 'image'].includes(effectiveType.value);
});

const isLinearElement = computed(() => {
  return effectiveType.value === 'arrow' || effectiveType.value === 'line';
});
const isArrowElement = computed(() => effectiveType.value === 'arrow');

const isTextOrHasText = computed(() => {
  if (!primaryElement.value) return false;
  if (primaryElement.value.type === 'text') return true;
  return primaryElement.value.boundElements?.some((b) => b.type === 'text') ?? false;
});

const textElement = computed((): DrawTextElement | null => {
  if (!primaryElement.value) return null;
  if (primaryElement.value.type === 'text') return primaryElement.value as DrawTextElement;
  const bound = primaryElement.value.boundElements?.find((b) => b.type === 'text');
  if (bound) {
    const el = store.scene.getElement(bound.id);
    if (el && !el.isDeleted && el.type === 'text') return el as DrawTextElement;
  }
  return null;
});

// ---- Property values ----
const strokeColor = computed({
  get: () => primaryElement.value?.strokeColor ?? store.currentItemStrokeColor,
  set: (val: string) => {
    store.recordHistory();
    store.currentItemStrokeColor = val;
    for (const el of store.selectedElements) {
      store.updateElement(el.id, { strokeColor: val } as any);
    }
  },
});

const backgroundColor = computed({
  get: () => primaryElement.value?.backgroundColor ?? store.currentItemBackgroundColor,
  set: (val: string) => {
    store.recordHistory();
    store.currentItemBackgroundColor = val;
    for (const el of store.selectedElements) {
      store.updateElement(el.id, { backgroundColor: val } as any);
    }
  },
});

const fillStyle = computed({
  get: () => (primaryElement.value?.fillStyle ?? store.currentItemFillStyle) as FillStyle,
  set: (val: FillStyle) => {
    store.recordHistory();
    store.currentItemFillStyle = val;
    for (const el of store.selectedElements) {
      store.updateElement(el.id, { fillStyle: val } as any);
    }
  },
});

const strokeWidth = computed({
  get: () => primaryElement.value?.strokeWidth ?? store.currentItemStrokeWidth,
  set: (val: number) => {
    store.recordHistory();
    store.currentItemStrokeWidth = val;
    for (const el of store.selectedElements) {
      store.updateElement(el.id, { strokeWidth: val } as any);
    }
  },
});

const strokeStyle = computed({
  get: () => (primaryElement.value?.strokeStyle ?? store.currentItemStrokeStyle) as StrokeStyle,
  set: (val: StrokeStyle) => {
    store.recordHistory();
    store.currentItemStrokeStyle = val;
    for (const el of store.selectedElements) {
      store.updateElement(el.id, { strokeStyle: val } as any);
    }
  },
});

const roughness = computed({
  get: () => primaryElement.value?.roughness ?? store.currentItemRoughness,
  set: (val: number) => {
    store.recordHistory();
    store.currentItemRoughness = val;
    for (const el of store.selectedElements) {
      store.updateElement(el.id, { roughness: val } as any);
    }
  },
});

const isRound = computed({
  get: () => {
    if (!primaryElement.value) return true;
    return primaryElement.value.roundness != null;
  },
  set: (val: boolean) => {
    store.recordHistory();
    for (const el of store.selectedElements) {
      let roundness = null;
      if (val) {
        const isLinear = el.type === 'line' || el.type === 'arrow';
        roundness = {
          type: isLinear
            ? ROUNDNESS.PROPORTIONAL_RADIUS
            : ROUNDNESS.ADAPTIVE_RADIUS,
        };
      }
      store.updateElement(el.id, { roundness } as any);
    }
  },
});

const opacity = computed({
  get: () => primaryElement.value?.opacity ?? store.currentItemOpacity,
  set: (val: number) => {
    store.recordHistory();
    store.currentItemOpacity = val;
    for (const el of store.selectedElements) {
      store.updateElement(el.id, { opacity: val } as any);
    }
  },
});

const arrowType = computed({
  get: () => {
    if (!isArrowElement.value) return 'round';
    return (primaryElement.value as DrawArrowElement)?.elbowed ? 'elbow' : store.currentItemArrowType;
  },
  set: (val: string) => {
    store.recordHistory();
    store.currentItemArrowType = val as any;
    for (const el of store.selectedElements) {
      if (el.type === 'arrow') {
        store.updateElement(el.id, { elbowed: val === 'elbow' } as any);
        if (val === 'elbow') store.updateBindingsAfterMove(el.id);
      }
    }
  },
});

const startArrowhead = computed({
  get: () => {
    if (!isLinearElement.value) return null;
    return (primaryElement.value as DrawLinearElement)?.startArrowhead ?? null;
  },
  set: (val: Arrowhead | null) => {
    store.recordHistory();
    store.currentItemStartArrowhead = val;
    for (const el of store.selectedElements) {
      if (el.type === 'arrow' || el.type === 'line') {
        store.updateElement(el.id, { startArrowhead: val } as any);
      }
    }
  },
});

const endArrowhead = computed({
  get: () => {
    if (!isLinearElement.value) return null;
    return (primaryElement.value as DrawLinearElement)?.endArrowhead ?? null;
  },
  set: (val: Arrowhead | null) => {
    store.recordHistory();
    store.currentItemEndArrowhead = val;
    for (const el of store.selectedElements) {
      if (el.type === 'arrow' || el.type === 'line') {
        store.updateElement(el.id, { endArrowhead: val } as any);
      }
    }
  },
});

function updateTextProperty(updates: Partial<DrawTextElement>) {
  for (const el of store.selectedElements) {
    if (el.type === 'text') {
      store.updateElement(el.id, updates as any);
      const textEl = store.scene.getElement(el.id) as DrawTextElement;
      if (textEl) {
        const container = getContainerElement(textEl, store.scene);
        redrawTextBoundingBox(textEl, container, store.scene);
      }
    } else {
      const boundText = getBoundTextElement(el, store.scene);
      if (boundText) {
        store.updateElement(boundText.id, updates as any);
        const updated = store.scene.getElement(boundText.id) as DrawTextElement;
        if (updated) redrawTextBoundingBox(updated, el, store.scene);
      }
    }
  }
  store.requestRender();
}

const fontFamily = computed({
  get: () => textElement.value?.fontFamily ?? store.currentItemFontFamily,
  set: (val: number) => {
    store.recordHistory();
    store.currentItemFontFamily = val;
    const lineHeight = FONT_METADATA[val]?.lineHeight ?? 1.25;
    updateTextProperty({ fontFamily: val, lineHeight } as Partial<DrawTextElement>);
  },
});

const fontSize = computed({
  get: () => textElement.value?.fontSize ?? store.currentItemFontSize,
  set: (val: number) => {
    store.recordHistory();
    store.currentItemFontSize = val;
    updateTextProperty({ fontSize: val } as Partial<DrawTextElement>);
  },
});

const textAlign = computed({
  get: () => (textElement.value?.textAlign ?? 'left') as TextAlign,
  set: (val: TextAlign) => {
    store.recordHistory();
    updateTextProperty({ textAlign: val } as Partial<DrawTextElement>);
  },
});

const verticalAlign = computed({
  get: () => (textElement.value?.verticalAlign ?? 'top') as VerticalAlign,
  set: (val: VerticalAlign) => {
    store.recordHistory();
    updateTextProperty({ verticalAlign: val } as Partial<DrawTextElement>);
  },
});

// ---- Options data ----
const fillStyleOptions = [
  { value: 'hachure' as FillStyle, icon: FillHachureIcon, label: 'draw.fillStyle.hachure' },
  { value: 'cross-hatch' as FillStyle, icon: FillCrossHatchIcon, label: 'draw.fillStyle.crossHatch' },
  { value: 'solid' as FillStyle, icon: FillSolidIcon, label: 'draw.fillStyle.solid' },
  { value: 'zigzag' as FillStyle, icon: FillZigZagIcon, label: 'draw.fillStyle.zigzag' },
];

const strokeWidthOptions = [
  { value: 1, icon: StrokeWidthThinIcon, label: 'draw.label.thin' },
  { value: 2, icon: StrokeWidthBoldIcon, label: 'draw.label.bold' },
  { value: 4, icon: StrokeWidthExtraBoldIcon, label: 'draw.label.extraBold' },
];

const strokeStyleOptions = [
  { value: 'solid' as StrokeStyle, icon: StrokeStyleSolidIcon, label: 'draw.strokeStyle.solid' },
  { value: 'dashed' as StrokeStyle, icon: StrokeStyleDashedIcon, label: 'draw.strokeStyle.dashed' },
  { value: 'dotted' as StrokeStyle, icon: StrokeStyleDottedIcon, label: 'draw.strokeStyle.dotted' },
];

const sloppinessOptions = [
  { value: 0, icon: SloppinessArchitectIcon, label: 'draw.label.architect' },
  { value: 1, icon: SloppinessArtistIcon, label: 'draw.label.artist' },
  { value: 2, icon: SloppinessCartoonistIcon, label: 'draw.label.cartoonist' },
];

const arrowTypeOptions = [
  { value: 'sharp', icon: ArrowTypeSharpIcon, label: 'draw.property.arrowTypeSharp' },
  { value: 'round', icon: ArrowTypeRoundIcon, label: 'draw.property.arrowTypeRound' },
  { value: 'elbow', icon: ArrowTypeElbowIcon, label: 'draw.property.arrowTypeElbow' },
];

const startArrowheadOptions = [
  { value: null as Arrowhead | null, icon: ArrowheadNoneStartIcon, label: 'draw.arrowhead.none' },
  { value: 'arrow' as Arrowhead, icon: ArrowheadArrowStartIcon, label: 'draw.arrowhead.arrow' },
  { value: 'triangle' as Arrowhead, icon: ArrowheadTriangleStartIcon, label: 'draw.arrowhead.triangle' },
  { value: 'bar' as Arrowhead, icon: ArrowheadBarStartIcon, label: 'draw.arrowhead.bar' },
  { value: 'circle' as Arrowhead, icon: ArrowheadCircleStartIcon, label: 'draw.arrowhead.circle' },
  { value: 'diamond' as Arrowhead, icon: ArrowheadDiamondStartIcon, label: 'draw.arrowhead.diamond' },
];

const endArrowheadOptions = [
  { value: null as Arrowhead | null, icon: ArrowheadNoneIcon, label: 'draw.arrowhead.none' },
  { value: 'arrow' as Arrowhead, icon: ArrowheadArrowIcon, label: 'draw.arrowhead.arrow' },
  { value: 'triangle' as Arrowhead, icon: ArrowheadTriangleIcon, label: 'draw.arrowhead.triangle' },
  { value: 'bar' as Arrowhead, icon: ArrowheadBarIcon, label: 'draw.arrowhead.bar' },
  { value: 'circle' as Arrowhead, icon: ArrowheadCircleIcon, label: 'draw.arrowhead.circle' },
  { value: 'diamond' as Arrowhead, icon: ArrowheadDiamondIcon, label: 'draw.arrowhead.diamond' },
];

const fontFamilyOptions = [
  { value: FONT_FAMILY.Excalifont, icon: FontHandDrawnIcon, label: 'draw.font.handDrawn' },
  { value: FONT_FAMILY.Nunito, icon: FontNormalIcon, label: 'draw.font.normal' },
  { value: FONT_FAMILY['Comic Shanns'], icon: FontCodeIcon, label: 'draw.font.code' },
];

const fontSizeOptions = [16, 20, 28, 36, 48, 64];

const hasLink = computed(() => {
  return primaryElement.value?.link != null && primaryElement.value.link !== '';
});

const canDistribute = computed(() => store.selectedElements.length >= 3);

function openHyperlinkEditor() {
  store.showHyperlinkPopup = 'editor';
}
</script>

<template>
  <div
    v-if="showPanel"
    class="zq-draw-property-panel"
  >
    <!-- Stroke Color -->
    <fieldset v-if="hasStrokeColor" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.strokeColor') }}
      </legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="color in PRESET_STROKE_COLORS"
          :key="color"
          class="prop-color-btn"
          :class="{ 'prop-color-selected': strokeColor === color }"
          :style="{ backgroundColor: color }"
          :title="color"
          @click="strokeColor = color"
        />
        <button
          class="prop-color-btn prop-color-custom"
          :class="{ 'prop-color-selected': !PRESET_STROKE_COLORS.includes(strokeColor) && strokeColor !== '' }"
          :style="!PRESET_STROKE_COLORS.includes(strokeColor) ? { backgroundColor: strokeColor } : {}"
          :title="t('draw.property.customColor')"
          @click="openStrokeColorPicker"
        />
        <input
          ref="strokeColorInputRef"
          type="color"
          class="prop-color-native-input"
          :value="strokeColor"
          @input="onStrokeColorInput"
        />
      </div>
    </fieldset>

    <!-- Background Color -->
    <fieldset v-if="hasBackground" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.backgroundColor') }}
      </legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="color in PRESET_BACKGROUND_COLORS"
          :key="color"
          class="prop-color-btn"
          :class="{
            'prop-color-selected': backgroundColor === color,
            'prop-color-transparent': color === 'transparent',
          }"
          :style="color !== 'transparent' ? { backgroundColor: color } : {}"
          :title="color === 'transparent' ? 'Transparent' : color"
          @click="backgroundColor = color"
        />
        <button
          class="prop-color-btn prop-color-custom"
          :class="{ 'prop-color-selected': !PRESET_BACKGROUND_COLORS.includes(backgroundColor) && backgroundColor !== '' }"
          :style="!PRESET_BACKGROUND_COLORS.includes(backgroundColor) ? { backgroundColor } : {}"
          :title="t('draw.property.customColor')"
          @click="openBgColorPicker"
        />
        <input
          ref="bgColorInputRef"
          type="color"
          class="prop-color-native-input"
          :value="backgroundColor === 'transparent' ? '#ffffff' : backgroundColor"
          @input="onBgColorInput"
        />
      </div>
    </fieldset>

    <!-- Fill Style -->
    <fieldset v-if="showFillStyle" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.fillStyle') }}
      </legend>
      <div class="flex gap-1">
        <button
          v-for="opt in fillStyleOptions"
          :key="opt.value"
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': fillStyle === opt.value }"
          :title="t(opt.label)"
          @click="fillStyle = opt.value"
          v-html="opt.icon"
        />
      </div>
    </fieldset>

    <!-- Stroke Width -->
    <fieldset v-if="hasStrokeWidth" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.strokeWidth') }}
      </legend>
      <div class="flex gap-1">
        <button
          v-for="opt in strokeWidthOptions"
          :key="opt.value"
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': strokeWidth === opt.value }"
          :title="t(opt.label)"
          @click="strokeWidth = opt.value"
          v-html="opt.icon"
        />
      </div>
    </fieldset>

    <!-- Stroke Style + Sloppiness -->
    <fieldset v-if="hasStrokeStyle" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.strokeStyle') }}
      </legend>
      <div class="flex gap-1">
        <button
          v-for="opt in strokeStyleOptions"
          :key="opt.value"
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': strokeStyle === opt.value }"
          :title="t(opt.label)"
          @click="strokeStyle = opt.value"
          v-html="opt.icon"
        />
      </div>
    </fieldset>

    <fieldset v-if="hasStrokeStyle" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.sloppiness') }}
      </legend>
      <div class="flex gap-1">
        <button
          v-for="opt in sloppinessOptions"
          :key="opt.value"
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': roughness === opt.value }"
          :title="t(opt.label)"
          @click="roughness = opt.value"
          v-html="opt.icon"
        />
      </div>
    </fieldset>

    <!-- Edges (Roundness) -->
    <fieldset v-if="canChangeRoundness" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.edges') }}
      </legend>
      <div class="flex gap-1">
        <button
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': !isRound }"
          :title="t('draw.property.edgesSharp')"
          @click="isRound = false"
          v-html="EdgeSharpIcon"
        />
        <button
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': isRound }"
          :title="t('draw.property.edgesRound')"
          @click="isRound = true"
          v-html="EdgeRoundIcon"
        />
      </div>
    </fieldset>

    <!-- Arrow Type -->
    <fieldset v-if="isArrowElement" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.arrowType') }}
      </legend>
      <div class="flex gap-1">
        <button
          v-for="opt in arrowTypeOptions"
          :key="opt.value"
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': arrowType === opt.value }"
          :title="t(opt.label)"
          @click="arrowType = opt.value"
          v-html="opt.icon"
        />
      </div>
    </fieldset>

    <!-- Font Family -->
    <fieldset v-if="isTextOrHasText" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.fontFamily') }}
      </legend>
      <div class="flex gap-1">
        <button
          v-for="opt in fontFamilyOptions"
          :key="opt.value"
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': fontFamily === opt.value }"
          :title="t(opt.label)"
          @click="fontFamily = opt.value"
          v-html="opt.icon"
        />
      </div>
    </fieldset>

    <!-- Font Size -->
    <fieldset v-if="isTextOrHasText" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.fontSize') }}
      </legend>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="size in fontSizeOptions"
          :key="size"
          class="prop-text-btn"
          :class="{ 'prop-text-btn--active': fontSize === size }"
          @click="fontSize = size"
        >
          {{ size }}
        </button>
      </div>
      <div class="mt-1.5 flex items-center gap-0.5">
        <button class="prop-sm-btn" @click="fontSize = Math.max(8, fontSize - 2)">
          <MinusIcon class="h-3 w-3" />
        </button>
        <span class="prop-fontsize-value">{{ fontSize }}</span>
        <button class="prop-sm-btn" @click="fontSize = Math.min(120, fontSize + 2)">
          <PlusIcon class="h-3 w-3" />
        </button>
      </div>
    </fieldset>

    <!-- Text Align -->
    <fieldset v-if="isTextOrHasText" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.textAlign') }}
      </legend>
      <div class="flex gap-1">
        <button
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': textAlign === 'left' }"
          :title="'Left'"
          @click="textAlign = 'left'"
          v-html="TextAlignLeftIcon"
        />
        <button
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': textAlign === 'center' }"
          :title="'Center'"
          @click="textAlign = 'center'"
          v-html="TextAlignCenterIcon"
        />
        <button
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': textAlign === 'right' }"
          :title="'Right'"
          @click="textAlign = 'right'"
          v-html="TextAlignRightIcon"
        />
      </div>
    </fieldset>

    <!-- Vertical Align -->
    <fieldset v-if="isTextOrHasText && primaryElement?.type !== 'text'" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.verticalAlign') }}
      </legend>
      <div class="flex gap-1">
        <button
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': verticalAlign === 'top' }"
          :title="t('draw.verticalAlign.top')"
          @click="verticalAlign = 'top'"
          v-html="VerticalAlignTopIcon"
        />
        <button
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': verticalAlign === 'middle' }"
          :title="t('draw.verticalAlign.middle')"
          @click="verticalAlign = 'middle'"
          v-html="VerticalAlignMiddleIcon"
        />
        <button
          class="prop-icon-btn"
          :class="{ 'prop-icon-btn--active': verticalAlign === 'bottom' }"
          :title="t('draw.verticalAlign.bottom')"
          @click="verticalAlign = 'bottom'"
          v-html="VerticalAlignBottomIcon"
        />
      </div>
    </fieldset>

    <!-- Arrowheads -->
    <fieldset v-if="isLinearElement" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.arrowheadStart') }}
      </legend>
      <div class="flex gap-0.5">
        <button
          v-for="opt in startArrowheadOptions"
          :key="String(opt.value)"
          class="prop-arrowhead-btn"
          :class="{ 'prop-arrowhead-btn--active': startArrowhead === opt.value }"
          :title="t(opt.label)"
          @click="startArrowhead = opt.value"
          v-html="opt.icon"
        />
      </div>
      <legend class="prop-legend" style="margin-top: 8px">
        {{ t('draw.property.arrowheadEnd') }}
      </legend>
      <div class="flex gap-0.5">
        <button
          v-for="opt in endArrowheadOptions"
          :key="String(opt.value)"
          class="prop-arrowhead-btn"
          :class="{ 'prop-arrowhead-btn--active': endArrowhead === opt.value }"
          :title="t(opt.label)"
          @click="endArrowhead = opt.value"
          v-html="opt.icon"
        />
      </div>
    </fieldset>

    <!-- Opacity -->
    <fieldset class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.opacity') }}
      </legend>
      <div class="flex items-center gap-2">
        <ZqSlider
          :model-value="opacity"
          :min="0"
          :max="100"
          :step="10"
          class="flex-1"
          @update:model-value="(v: number) => opacity = v"
        />
        <span class="prop-opacity-value">{{ opacity }}</span>
      </div>
    </fieldset>

    <!-- Layers -->
    <fieldset v-if="isSingleSelect || isMultiSelect" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.layers') }}
      </legend>
      <div class="flex gap-1">
        <button
          class="prop-action-btn"
          :title="t('draw.menu.sendToBack')"
          @click="store.sendToBack()"
        >
          <ArrowDownToLine class="h-4 w-4" />
        </button>
        <button
          class="prop-action-btn"
          :title="t('draw.menu.sendBackward')"
          @click="store.sendBackward()"
        >
          <ArrowDown class="h-4 w-4" />
        </button>
        <button
          class="prop-action-btn"
          :title="t('draw.menu.bringForward')"
          @click="store.bringForward()"
        >
          <ArrowUp class="h-4 w-4" />
        </button>
        <button
          class="prop-action-btn"
          :title="t('draw.menu.bringToFront')"
          @click="store.bringToFront()"
        >
          <ArrowUpToLine class="h-4 w-4" />
        </button>
      </div>
    </fieldset>

    <!-- Actions -->
    <fieldset v-if="isSingleSelect || isMultiSelect" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.actions') }}
      </legend>
      <div class="flex gap-1">
        <button
          class="prop-action-btn"
          :title="t('draw.menu.duplicate')"
          @click="store.duplicateSelectedElements()"
        >
          <Copy class="h-4 w-4" />
        </button>
        <button
          class="prop-action-btn"
          :title="t('draw.menu.delete')"
          @click="store.deleteSelectedElementsWithBindings()"
        >
          <Trash2 class="h-4 w-4" />
        </button>
        <button
          class="prop-action-btn"
          :title="hasLink ? t('draw.menu.editLink') : t('draw.menu.addLink')"
          @click="openHyperlinkEditor"
        >
          <Link class="h-4 w-4" />
        </button>
      </div>
    </fieldset>

    <!-- Align / Distribute (multi-select) -->
    <fieldset v-if="isMultiSelect" class="mb-3">
      <legend class="prop-legend">
        {{ t('draw.property.alignDistribute') }}
      </legend>
      <div class="mb-1 flex gap-1">
        <button class="prop-sm-btn" :title="t('draw.menu.alignLeft')" @click="store.alignSelected({ position: 'start', axis: 'x' })">
          <AlignStartHorizontal class="h-3.5 w-3.5" />
        </button>
        <button class="prop-sm-btn" :title="t('draw.menu.alignCenter')" @click="store.alignSelected({ position: 'center', axis: 'x' })">
          <AlignCenterHorizontal class="h-3.5 w-3.5" />
        </button>
        <button class="prop-sm-btn" :title="t('draw.menu.alignRight')" @click="store.alignSelected({ position: 'end', axis: 'x' })">
          <AlignEndHorizontal class="h-3.5 w-3.5" />
        </button>
        <button class="prop-sm-btn" :title="t('draw.menu.alignTop')" @click="store.alignSelected({ position: 'start', axis: 'y' })">
          <AlignStartVertical class="h-3.5 w-3.5" />
        </button>
        <button class="prop-sm-btn" :title="t('draw.menu.alignMiddle')" @click="store.alignSelected({ position: 'center', axis: 'y' })">
          <AlignCenterVertical class="h-3.5 w-3.5" />
        </button>
        <button class="prop-sm-btn" :title="t('draw.menu.alignBottom')" @click="store.alignSelected({ position: 'end', axis: 'y' })">
          <AlignEndVertical class="h-3.5 w-3.5" />
        </button>
      </div>
      <div v-if="canDistribute" class="flex gap-1">
        <button class="prop-sm-btn" :title="t('draw.menu.distributeH')" @click="store.distributeSelected({ space: 'between', axis: 'x' })">
          <AlignHorizontalSpaceAround class="h-3.5 w-3.5" />
        </button>
        <button class="prop-sm-btn" :title="t('draw.menu.distributeV')" @click="store.distributeSelected({ space: 'between', axis: 'y' })">
          <AlignVerticalSpaceAround class="h-3.5 w-3.5" />
        </button>
      </div>
    </fieldset>

    <div v-if="isMultiSelect" class="prop-mixed-text">
      {{ t('draw.property.mixed') }}
    </div>
  </div>
</template>

<style scoped>
.zq-draw-property-panel {
  position: absolute;
  right: 8px;
  top: 32px;
  z-index: 20;
  width: 228px;
  max-height: calc(100% - 80px);
  overflow-y: auto;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-editor);
  padding: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.prop-legend {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
}

.prop-color-selected {
  box-shadow: 0 0 0 2px var(--bg-editor), 0 0 0 4px var(--accent-color);
}

.prop-mixed-text {
  font-size: 12px;
  color: var(--text-tertiary);
}

.prop-opacity-value {
  width: 32px;
  text-align: right;
  font-size: 12px;
  color: var(--text-tertiary);
}

.prop-fontsize-value {
  min-width: 2rem;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.prop-color-btn {
  height: 22px;
  width: 22px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.15s;
}
.prop-color-btn:hover {
  transform: scale(1.1);
}
.prop-color-transparent {
  background: repeating-conic-gradient(#ccc 0 25%, transparent 0 50%) 0 0 / 8px 8px;
}
.prop-color-custom {
  background: conic-gradient(
    from 0deg,
    #ff0000, #ff8800, #ffff00, #00ff00, #00ffff, #0000ff, #8800ff, #ff0088, #ff0000
  );
}
.prop-color-native-input {
  position: absolute;
  height: 0;
  width: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.prop-icon-btn {
  display: flex;
  height: 32px;
  width: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
  color: var(--text-secondary);
  background: none;
}
.prop-icon-btn:hover {
  background: var(--bg-hover);
}
.prop-icon-btn--active {
  background: var(--accent-shadow);
  border-color: var(--accent-color);
  color: var(--accent-color);
}
.prop-icon-btn :deep(svg) {
  height: 20px;
  width: 20px;
}

.prop-arrowhead-btn {
  display: flex;
  height: 28px;
  flex: 1;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
  color: var(--text-secondary);
  background: none;
}
.prop-arrowhead-btn:hover {
  background: var(--bg-hover);
}
.prop-arrowhead-btn--active {
  background: var(--accent-shadow);
  border-color: var(--accent-color);
  color: var(--accent-color);
}
.prop-arrowhead-btn :deep(svg) {
  height: 20px;
  width: 100%;
}

.prop-text-btn {
  display: flex;
  height: 28px;
  min-width: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid transparent;
  padding: 0 6px;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
  background: none;
  color: var(--text-secondary);
}
.prop-text-btn:hover {
  background: var(--bg-hover);
}
.prop-text-btn--active {
  background: var(--accent-shadow);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.prop-action-btn {
  display: flex;
  height: 36px;
  width: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
  color: var(--text-secondary);
  border: none;
  background: none;
}
.prop-action-btn:hover {
  background: var(--bg-hover);
}

.prop-sm-btn {
  display: flex;
  height: 28px;
  width: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
  border: none;
  background: none;
  color: var(--text-secondary);
}
.prop-sm-btn:hover {
  background: var(--bg-hover);
}
</style>
