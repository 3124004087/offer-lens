<script setup lang="ts">
// components/common/StateBlock.vue
// 「加载中 / 空 / 出错」三种占位状态的样子。
//
// 只负责长什么样，不负责判断该显示哪个 —— 判断逻辑留在页面里。
// 因为每个页面的判断条件都不一样：历史页看 status，面试题页看 view，
// 结果页还要区分「还在读」和「真没有」。把判断塞进组件，这个组件就废了。
withDefaults(
  defineProps<{
    variant: 'loading' | 'empty' | 'error'
    /** 主标题，空态和错误态必填 */
    title?: string
    /** 一句话说明 */
    desc?: string
    /** 更小的一行补充，比如「换个普通窗口再试」 */
    hint?: string
    /** 传了才出重试按钮，不传就没有这个按钮 */
    retryText?: string
  }>(),
  { title: '', desc: '', hint: '', retryText: '' },
)

// 重试这件事页面才知道怎么做，组件只负责把「用户点了」传出去
const emit = defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <section class="card state" :class="`state--${variant}`" :aria-busy="variant === 'loading'">
    <!-- 加载中：三条灰条，比「加载中…」几个字更像在干活 -->
    <template v-if="variant === 'loading'">
      <span v-if="title" class="title">{{ title }}</span>
      <div class="sk" style="width: 100%" />
      <div class="sk" style="width: 72%" />
      <div class="sk" style="width: 44%" />
    </template>

    <template v-else>
      <p class="title">{{ title }}</p>
      <p v-if="desc" class="text-sm text-2 desc">{{ desc }}</p>
      <p v-if="hint" class="text-xs text-3">{{ hint }}</p>

      <!-- 操作区：重试按钮 + 页面自己塞进来的链接（比如「去工作台」） -->
      <div v-if="retryText || $slots.actions" class="actions">
        <button v-if="retryText" type="button" class="btn" @click="emit('retry')">
          {{ retryText }}
        </button>
        <slot name="actions" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 28px 18px;
}

.title {
  font-size: 15px;
  font-weight: 600;
}

.desc {
  max-width: 46em;
  line-height: 1.7;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

/* 骨架条：灰底 + 一道高光扫过，扫的方向从左到右 */
.sk {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #f1f1f3 25%, #e7e7ea 37%, #f1f1f3 63%);
  background-size: 400% 100%;
  animation: sk 1.4s ease infinite;
}

@keyframes sk {
  from {
    background-position: 100% 50%;
  }
  to {
    background-position: 0 50%;
  }
}

/* 用户在系统里关了动画就别抖，静态灰条一样能表达「还没好」 */
@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
