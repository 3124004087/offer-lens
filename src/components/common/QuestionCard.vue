<script setup lang="ts">
// 一道面试题的展示层。只干三件事：显示问句、折叠思路、转发自评点击。
// 不请求数据、不存「是否展开」「会不会」—— 这两个状态都归父组件，
// 原因就是今天那道八股：Tab 用 v-if 切换会把本组件卸载，内部状态一起没。
import type { Question } from '@/types'

withDefaults(
  defineProps<{
    item: Question
    // 展开状态由父组件托管，所以这里只是「读」
    open?: boolean
  }>(),
  { open: false },
)

const emit = defineEmits<{
  // 括号里是参数类型：toggle 带一个 id，mastered 带 id + 会/不会
  toggle: [id: string]
  mastered: [id: string, value: boolean]
}>()
</script>

<template>
  <article class="qc" :class="{ 'qc--done': item.mastered }">
    <div class="qc-head">
      <div class="qc-main">
        <!-- 难度：三个点，亮几个就是几级。用 span 不用图标，省一个依赖 -->
        <span class="qc-dots" :aria-label="`难度 ${item.difficulty} / 3`">
          <i v-for="n in 3" :key="n" class="qc-dot" :class="{ 'qc-dot--on': n <= item.difficulty }" />
        </span>
        <p class="qc-q">{{ item.question }}</p>
      </div>

      <button
        type="button"
        class="qc-toggle"
        :aria-expanded="open"
        @click="emit('toggle', item.id)"
      >
        {{ open ? '收起' : '看思路' }}
      </button>
    </div>

    <template v-if="open">
      <!-- 模型偶尔不给思路。空着会让人以为折叠坏了，所以给一句兜底 -->
      <p class="qc-hint">{{ item.hint || '这次没给思路提示，可以点「换一批」重新生成。' }}</p>

      <div class="qc-actions">
        <button
          type="button"
          class="qc-btn"
          :class="{ 'qc-btn--ok': item.mastered }"
          @click="emit('mastered', item.id, true)"
        >
          会
        </button>
        <button
          type="button"
          class="qc-btn"
          :class="{ 'qc-btn--no': !item.mastered }"
          @click="emit('mastered', item.id, false)"
        >
          还不会
        </button>
      </div>
    </template>
  </article>
</template>

<style scoped>
.qc {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--c-border);
  /* 左侧竖线表示自评状态，和改写卡片的色标是同一套语言 */
  border-left: 3px solid var(--c-border);
  border-radius: var(--radius);
  background: var(--c-surface);
}

.qc--done {
  border-left-color: var(--c-success);
  background: var(--c-success-weak);
}

.qc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.qc-main {
  min-width: 0; /* flex 子项默认 min-width: auto，长问句会把按钮挤出去 */
}

.qc-dots {
  display: flex;
  gap: 3px;
  margin-bottom: 6px;
}

.qc-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--c-border);
}

.qc-dot--on {
  background: var(--c-warn);
}

.qc-q {
  font-size: 14px;
  line-height: 1.6;
  font-weight: 500;
  /* 题目里常有 Vue3+Vite、Webpack5 这种长串，不 break 会撑破卡片 */
  word-break: break-word;
}

.qc-toggle {
  flex: none;
  padding: 2px 8px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
}

.qc-toggle:hover {
  color: var(--c-text);
  border-color: var(--c-text-3);
}

.qc-hint {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--c-bg);
  font-size: 13px;
  line-height: 1.7;
  color: var(--c-text-2);
  /* 思路是模型按行分的点，保留换行 */
  white-space: pre-wrap;
  word-break: break-word;
}

.qc-actions {
  display: flex;
  gap: 8px;
}

.qc-btn {
  padding: 3px 12px;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 12px;
  cursor: pointer;
}

/* 选中的那个才上色：两个都上色就看不出选的是哪个了 */
.qc-btn--ok {
  border-color: var(--c-success);
  background: var(--c-success-weak);
  color: var(--c-success);
}

.qc-btn--no {
  border-color: var(--c-warn);
  background: var(--c-warn-weak);
  color: var(--c-warn);
}
</style>
