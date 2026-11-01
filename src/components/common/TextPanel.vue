<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 双栏通用输入面板：简历 / JD 复用
 * 用法：<TextPanel v-model="store.resumeText" title="我的简历" />
 */
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

const pasteHint = ref('')
const isPasting = ref(false)

/**
 * 读系统剪贴板并追加到输入框；失败只提示，不阻断输入。
 * 放在 computed 之后声明，避免依赖「点击时才调用」来绕过暂时性死区。
 */
async function pasteFromClipboard() {
  // 防连点：readText 是异步的，等待期间按钮还能点，两次都成功就会追加两遍
  if (isPasting.value) return
  pasteHint.value = ''

  // 非 https 且非 localhost 时 navigator.clipboard 是 undefined，
  // 直接调 readText 会抛 TypeError。先判空，才能给出准确的提示
  if (!navigator.clipboard?.readText) {
    pasteHint.value = '当前环境不支持自动读取剪贴板，请手动 Ctrl/Cmd + V'
    return
  }

  isPasting.value = true
  try {
    const clip = await navigator.clipboard.readText()
    if (!clip.trim()) {
      pasteHint.value = '剪贴板是空的'
      return
    }
    const next = props.modelValue ? props.modelValue + '\n' + clip : clip
    // 赋值给 text 会走 set，自动享受 maxLength 截断
    text.value = next
    // 追加模式下是从尾部截断，被砍掉的是刚粘进来的内容，必须说出来
    if (next.length > props.maxLength) {
      pasteHint.value = `已到 ${props.maxLength} 字上限，后粘的部分没放进去`
    }
  } catch {
    // 用户点了拒绝或系统策略拦截；重试不会再弹授权，只能退化成手动粘贴
    pasteHint.value = '没有剪贴板权限，请手动 Ctrl/Cmd + V'
  } finally {
    isPasting.value = false
  }
}

/** 用户开始手动输入时收掉上一次的粘贴提示，避免提示一直挂着误导 */
function clearPasteHint() {
  if (pasteHint.value) pasteHint.value = ''
}
</script>

<template>
  <section class="panel card">
    <header class="panel-head">
      <div>
        <h2 class="panel-title">{{ title }}</h2>
        <p v-if="subtitle" class="panel-sub text-xs text-3">{{ subtitle }}</p>
      </div>
      <div class="panel-tools">
        <button
          class="btn paste-btn"
          type="button"
          :disabled="isPasting"
          @click="pasteFromClipboard"
        >
          {{ isPasting ? '读取中…' : '粘贴' }}
        </button>
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
      @input="clearPasteHint"
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
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.paste-btn {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: var(--radius-sm);
}

.paste-btn:disabled {
  opacity: 0.55;
  cursor: default;
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
