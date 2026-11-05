<script setup lang="ts">
/**
 * 流式文本容器：只负责「看起来在打字」。
 * 不发请求、不解析流——那些在 useAIStream 里，这里只渲染传进来的 text。
 */
withDefaults(
  defineProps<{
    text: string
    loading?: boolean
    placeholder?: string
  }>(),
  {
    loading: false,
    placeholder: '点「试跑」，看字是不是一个一个出来的。',
  },
)
</script>

<template>
  <div class="wrap">
    <!-- 光标只在 loading 时挂，请求结束自动消失 -->
    <pre v-if="text" class="box" :class="{ typing: loading }">{{ text }}</pre>
    <p v-else class="empty">{{ placeholder }}</p>
  </div>
</template>

<style scoped>
.wrap {
  min-height: 120px; /* 内容出现前后高度不跳，避免按钮被顶下去 */
}

.box {
  margin: 0;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-bg);
  color: var(--c-text);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap; /* 保留换行，同时自动折行 */
  word-break: break-word;
}

/* 光标用伪元素：不进入文本节点，用户复制时不会带上一个方块 */
.typing::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  background: currentColor;
  vertical-align: -0.15em;
  animation: blink 1s step-end infinite;
}

/* step-end：硬切，不做淡入淡出，才像终端光标 */
@keyframes blink {
  50% {
    opacity: 0;
  }
}

.empty {
  margin: 0;
  padding: 12px;
  font-size: 13px;
  color: var(--c-text-3);
}
</style>
