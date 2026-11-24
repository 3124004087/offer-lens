<script setup lang="ts">
// 改写建议的「展示层」：把 items 画成左右对比，每条带一个「复制」按钮。
// 不请求数据 —— 请求在 useRewrite，触发在 Result.vue。
// 这样以后历史记录页（W3D3）想展示旧的改写，直接传 items 进来就能用。
import { ref } from 'vue'
import type { RewriteItem } from '@/types'

withDefaults(
  defineProps<{
    items: RewriteItem[]
    // 流式进行中：用来区分「还在生成」和「真的一条都没有」
    loading?: boolean
    error?: string | null
  }>(),
  { loading: false, error: null },
)

// 模型只允许吐 weak / missing / good，这里翻成人话。
// 用 Record 表而不是 if-else 链：将来加类型只改这一处，模板不用动
const TYPE_LABEL: Record<RewriteItem['type'], string> = {
  weak: '表达偏弱',
  missing: '缺关键词',
  good: '本来就挺好',
}

// 点完要让用户知道「成了」。只记 id 而不是布尔值：
// 六张卡片共用一个状态的话，点一条会让六条一起变「已复制」
const copiedId = ref('')
let timer: number | undefined

/**
 * @param text 要复制的文字
 * @param id   哪一条，只用来做「已复制」的视觉反馈，不参与复制本身
 */
async function copy(text: string, id: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    // 连点两次要把上一次的计时清掉，否则第一次的 1.5 秒会提前把第二次的提示收走
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      copiedId.value = ''
    }, 1500)
  } catch (err) {
    console.error(err)
  }
}
</script>

<template>
  <div class="rw">
    <!-- 空态只在「没在加载、没报错、也确实没数据」时才显示。
         少判 loading 的话，点按钮到第一条到达之间（2-3 秒）会闪一下「还没有」，
         看着像功能坏了 -->
    <p v-if="!loading && !error && items.length === 0" class="rw-empty text-sm text-3">
      还没有改写建议。
    </p>

    <!-- 流式的第一秒是一条都没收到的，给个话让人知道在动 -->
    <p v-else-if="loading && items.length === 0" class="rw-empty text-sm text-2">
      正在读简历，第一条马上出来…
    </p>

    <!-- 关键结构：每一条自己是一个卡片，卡片内部再分左右两栏。
         不能写成「左边一个列表 + 右边一个列表」——流式追加时条数一变，
         左右两列就错位了，而且永远对不齐 -->
    <article
      v-for="item in items"
      :key="item.id"
      class="rw-item"
      :class="`rw-${item.type}`"
    >
      <div class="rw-head">
        <span class="rw-badge">{{ TYPE_LABEL[item.type] }}</span>
      </div>

      <div class="rw-side">
        <span class="rw-tag">原文</span>
        <p class="rw-text">{{ item.origin }}</p>
      </div>

      <div class="rw-side">
        <!-- 标签和按钮排成一行，按钮推到最右：不改的话标签长度一变，按钮就跟着抖 -->
        <div class="rw-copy-row">
          <span class="rw-tag">改写</span>
          <button
            type="button"
            class="rw-copy"
            :class="{ 'is-copied': copiedId === item.id }"
            @click="copy(item.suggestion, item.id)"
          >
            {{ copiedId === item.id ? '已复制' : '复制' }}
          </button>
        </div>
        <p class="rw-text rw-suggest">{{ item.suggestion }}</p>
        <p v-if="item.reason" class="rw-reason">{{ item.reason }}</p>
      </div>
    </article>

    <!-- 出错时已收到的条目照样留着：那些内容是真的，别把人辛苦等的东西一起清掉 -->
    <p v-if="error" class="rw-error text-sm">{{ error }}</p>
  </div>
</template>

<style scoped>
.rw {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rw-empty {
  padding: 4px 0;
}

.rw-item {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  padding: 12px;
  border: 1px solid var(--c-border);
  /* 左边这条竖线是类型色标。只染线条和徽标，不整块染底：
     6 条全彩叠在一起，字会看不清 */
  border-left: 3px solid var(--rw-color);
  border-radius: var(--radius);
  background: var(--c-surface);
}

/* 一套样式三套配色：把颜色收进局部变量，下面所有地方只引用变量。
   比写 .rw-weak .rw-badge / .rw-missing .rw-badge … 三份重复干净得多 */
.rw-weak {
  --rw-color: var(--c-warn);
  --rw-bg: var(--c-warn-weak);
}

.rw-missing {
  --rw-color: var(--c-danger);
  --rw-bg: var(--c-danger-weak);
}

.rw-good {
  --rw-color: var(--c-success);
  --rw-bg: var(--c-success-weak);
}

.rw-head {
  /* 横跨两栏：1 / -1 的意思是「从第一条网格线到最后一条」 */
  grid-column: 1 / -1;
}

.rw-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--rw-bg);
  color: var(--rw-color);
  font-size: 12px;
  line-height: 18px;
}

.rw-side {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0; /* 不给 0，长内容会把网格撑破（grid 子项默认 min-width: auto） */
}

.rw-tag {
  font-size: 12px;
  color: var(--c-text-3);
}

/* 标签在左、按钮在右。用 space-between 而不是给按钮加 margin-left：
   标签换行或变长时，按钮位置不受影响 */
.rw-copy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 22px;
}

/* 次要按钮：透明底 + 细边框。不用主色实心，
   因为它是「顺手拿走一句」的辅助动作，抢了眼睛就看不清正文了 */
.rw-copy {
  padding: 1px 9px;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  background: transparent;
  color: var(--c-text-2);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.rw-copy:hover {
  color: var(--c-text);
  border-color: var(--c-text-3);
}

/* 复制成功：临时变绿 1.5 秒，时间由 ts 里的 setTimeout 控制 */
.rw-copy.is-copied {
  border-color: var(--c-success);
  background: var(--c-success-weak);
  color: var(--c-success);
  cursor: default;
}

.rw-text {
  font-size: 13px;
  line-height: 1.65;
  /* 简历里可能有手打的换行，保留原样 */
  white-space: pre-wrap;
  /* 长英文串（Webpack5、Vue3+Vite）默认不在词中间断行，
     会把格子撑爆、整页出横向滚动条 */
  word-break: break-word;
}

.rw-suggest {
  color: var(--c-text);
  font-weight: 500;
}

.rw-reason {
  font-size: 12px;
  color: var(--c-text-2);
  word-break: break-word;
}

.rw-error {
  color: var(--c-danger);
}

/* 窄屏改成上下堆叠：手机上两栏各剩不到 160px，中文一行放不下 10 个字 */
@media (max-width: 640px) {
  .rw-item {
    grid-template-columns: 1fr;
  }
}
</style>
