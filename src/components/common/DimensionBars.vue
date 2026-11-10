<script setup lang="ts">
import type { DimensionScore } from '@/types'

defineProps<{ items: DimensionScore[] }>()

/**
 * 宽度兜底。
 * 为什么组件里还要再钳一次：这个组件不只服务评分页，以后历史记录页
 * 会拿半年前存下来的旧数据渲染，形状未必和今天一致。
 * 少这一行，一个 800 就能让进度条撑出卡片、手机整页能左右拖。
 */
function widthOf(score: number) {
  const n = Number(score)
  const safe = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
  return `${safe}%`
}
</script>

<template>
  <ul class="dims">
    <!-- key 用 name 不用 index：维度顺序可能被模型打乱，
         用下标会让「项目深度」那条复用「技术栈匹配」的 DOM -->
    <li v-for="d in items" :key="d.name" class="dim">
      <div class="line">
        <span class="name">{{ d.name }}</span>
        <span class="val">{{ d.score }}</span>
      </div>

      <div class="bar">
        <div class="bar-fill" :style="{ width: widthOf(d.score) }" />
      </div>

      <p v-if="d.comment" class="comment">{{ d.comment }}</p>
    </li>
  </ul>
</template>

<style scoped>
.dims {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
}

.name {
  font-size: 13px;
  color: var(--c-text);
}

.val {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-2);
  font-variant-numeric: tabular-nums;
}

.bar {
  height: 6px;
  border-radius: 999px;
  background: #f0f0f2;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--c-primary);
  transition: width 0.4s ease;
}

/* 模型给的是「30 字以内的评价」，限两行，多了截断，
   否则三条维度里有两条话多，整块高度就不齐了 */
.comment {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--c-text-3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
