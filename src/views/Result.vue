<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import KeywordTags from '@/components/common/KeywordTags.vue'
import { useWorkspaceStore } from '@/stores/workspace'

const route = useRoute()
const store = useWorkspaceStore()

const isLocalMode = computed(() => route.params.id === 'local')

/** 关键词覆盖率：命中 / JD 要求总数 */
const total = computed(() => store.keywordDiff.matched.length + store.keywordDiff.missing.length)
const rate = computed(() =>
  total.value === 0 ? 0 : Math.round((store.keywordDiff.matched.length / total.value) * 100),
)

const rateHint = computed(() => {
  if (total.value === 0) return '没有识别到技能关键词，JD 可能写得太抽象'
  if (rate.value >= 80) return '技能栈覆盖得不错，重点补项目深度'
  if (rate.value >= 50) return '基本功够了，缺的这几项面试大概率会问'
  return '差距明显，建议先补齐缺失项再投'
})
</script>

<template>
  <div class="stack">
    <header class="page-head">
      <div>
        <RouterLink to="/" class="back text-sm text-2">← 返回工作台</RouterLink>
        <h1 class="page-title">分析结果</h1>
        <p v-if="store.company || store.position" class="text-2">
          {{ store.company || '未填写公司' }} · {{ store.position || '未填写岗位' }}
        </p>
      </div>
    </header>

    <!-- 本地关键词概览（W1 已完成） -->
    <section class="card card-pad">
      <div class="sec-head">
        <h2 class="sec-title">关键词覆盖率</h2>
        <span class="rate">{{ rate }}%</span>
      </div>

      <div class="bar">
        <div class="bar-fill" :style="{ width: `${rate}%` }" />
      </div>
      <p class="text-sm text-2 hint">{{ rateHint }}</p>

      <div class="divider" />

      <KeywordTags
        :matched="store.keywordDiff.matched"
        :missing="store.keywordDiff.missing"
        :extra="store.keywordDiff.extra"
      />
    </section>

    <!-- 待接入模块 -->
    <section class="card card-pad pending">
      <h2 class="sec-title">AI 深度分析</h2>
      <p class="text-sm text-2">
        这一块还没有接上。按排期会在 W2 ~ W3 完成：
      </p>
      <ul class="todo">
        <li><span class="tag tag-neutral">W2</span> 匹配度评分（总分 + 三维度 + 一句话点评）</li>
        <li><span class="tag tag-neutral">W3</span> 逐段改写建议（原句 / 建议 / 为什么改）</li>
        <li><span class="tag tag-neutral">W3</span> 面试题预测（基础 / 项目 / 场景）</li>
        <li><span class="tag tag-neutral">W4</span> 历史记录与结果持久化</li>
      </ul>
      <p class="text-xs text-3 note">
        提示：这些是排期占位，不是 bug。先把本地能力打磨好，再接 AI。
      </p>
    </section>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.back {
  display: inline-block;
  margin-bottom: 6px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}

.sec-title {
  font-size: 14px;
  font-weight: 600;
}

.rate {
  font-size: 20px;
  font-weight: 600;
  color: var(--c-primary);
  font-variant-numeric: tabular-nums;
}

.bar {
  height: 8px;
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

.hint {
  margin-top: 8px;
}

.divider {
  height: 1px;
  margin: 16px 0;
  background: var(--c-border);
}

.pending {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.todo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.todo li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--c-text-2);
}

.note {
  margin-top: 2px;
}

@media (max-width: 640px) {
  .page-title {
    font-size: 19px;
  }
}
</style>
