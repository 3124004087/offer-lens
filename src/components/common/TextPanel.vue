<script setup lang="ts">
import { computed,ref } from 'vue'

/**
 * 双栏通用输入面板：简历 / JD 复用
 * 用法：<TextPanel v-model="store.resumeText" title="我的简历" />
 */
const pasteHint=ref('')

/** 读系统剪贴板并追加到输入框；失败只提示，不阻断输入 */
async function pasteFromClipboard() {
  pasteHint.value = ''
  try {
    // 非 https（非 localhost）时 navigator.clipboard 是 undefined，
    // 调用会抛 TypeError，统一被下面 catch 兜住
    const clip = await navigator.clipboard.readText()
    if (!clip.trim()) {
      pasteHint.value = '剪贴板是空的'
      return
    }
    // 赋值给 text 会走上面那个 set，自动享受 maxLength 截断
    text.value = props.modelValue ? props.modelValue + '\n' + clip : clip
  } catch {
    pasteHint.value = '浏览器不允许读剪贴板，请手动 Ctrl/Cmd + V'
  }
}

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    placeholder?: string
    modelValue: string
    maxLength?: number
    minLength?: number
    rows?: number
  }>(),
  {
    subtitle: '',
    placeholder: '把内容粘贴到这里…',
    maxLength: 8000,
    minLength: 100,
    rows: 16,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/** 超长直接截断，不弹窗打断输入（PRD §10 的边界处理） */
const text = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value.slice(0, props.maxLength)),
})

const count = computed(() => props.modelValue.length)
const isTooShort = computed(() => count.value > 0 && count.value < props.minLength)
const isNearLimit = computed(() => count.value >= props.maxLength * 0.9)
</script>

<template>
  <section class="panel card">
    <header class="panel-head">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p v-if="subtitle" class="panel-sub text-xs text-3">{{ subtitle }}</p>
      </div>
      <div class="panel-tools">
        <button class="btn paste-btn" type="button" @click="pasteFromClipboard">粘贴</button>
        <span class="counter" :class="{ 'is-warn': isNearLimit }">
          {{ count }} / {{ maxLength }}
        </span>
      </div>
    </header>

    <textarea
      v-model="text"
      class="panel-input"
      :rows="rows"
      :placeholder="placeholder"
      spellcheck="false"
    />

    <footer class="panel-foot">
      <slot name="footer" />
      <span v-if="pasteHint" class="hint warn">{{ pasteHint }}</span>
      <span v-if="isTooShort" class="hint warn">
        内容少于 {{ minLength }} 字，判断会不准
      </span>
      <span v-else-if="isNearLimit" class="hint warn">已接近上限，超出部分会被截断</span>
      <span v-else class="hint text-3">支持直接粘贴，草稿自动保存在本地</span>
    </footer>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--c-border);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
}

.panel-sub {
  margin-top: 2px;
}

.panel-tools {
 display: flex; align-items: center; gap: 8px; flex-shrink: 0; 
 }

.paste-btn {
 height: 28px; padding: 0 10px; font-size: 12px; border-radius: var(--radius-sm); 
 }

.counter {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--c-text-3);
  font-variant-numeric: tabular-nums;
}

.counter.is-warn {
  color: var(--c-warn);
}

.panel-input {
  flex: 1;
  width: 100%;
  min-height: 260px;
  padding: 14px 16px;
  border: 0;
  background: transparent;
  color: var(--c-text);
  line-height: 1.75;
  resize: vertical;
}

.panel-input:focus {
  outline: none;
}

.panel-input::placeholder {
  color: var(--c-text-3);
}

.panel:focus-within {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-weak);
}

.panel-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 16px 12px;
  border-top: 1px solid var(--c-border);
}

.hint {
  font-size: 12px;
}

.hint.warn {
  color: var(--c-warn);
}

@media (max-width: 640px) {
  .panel-input {
    min-height: 200px;
    resize: none;
  }
}
</style>
