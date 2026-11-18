<script setup lang="ts">
// views/History.vue
// 历史记录页的职责很单一：从 IndexedDB 取列表 → 渲染 → 点进去回看。
// 它**不发任何 AI 请求**，所以反复打开不花钱；回看用的是记录里存好的快照。
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAnalysisStore } from '@/stores/analysis'
import type { SavedAnalysis } from '@/types'

const analysis = useAnalysisStore()

const list = ref<SavedAnalysis[]>([])

/**
 * 一个字段管三种态：读取中 / 读失败 / 读到了。
 * 不用 isLoading + isError 两个布尔：它们能同时为 true，那页面该显示哪个？
 */
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMsg = ref('')

onMounted(async () => {
  try {
    list.value = await analysis.list()
    status.value = 'ready'
  } catch (e: any) {
    // 走到这通常是隐私模式禁了 IndexedDB，或者磁盘配额满了
    errorMsg.value = e?.message ?? '读取本地记录失败'
    status.value = 'error'
  }
})

/** 11月18日 15:30。用 toLocaleString 会带上「上午/下午」和年份，列表里太啰嗦 */
function fmtDate(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 标记已投递。
 *
 * 先改界面再写库（乐观更新）：点一下立刻变，不用等异步。
 * 写失败就把标签翻回去 —— 不能让用户看到一个「其实没存上」的已投递，
 * 那比点不动更糟：他会以为投过了。
 */
async function toggleApplied(item: SavedAnalysis) {
  const before = item.applied
  item.applied = !before

  const saved = await analysis.patch(item.id, { applied: item.applied })
  if (!saved) item.applied = before
}
</script>

<template>
  <div class="stack">
    <header class="page-head">
      <h1 class="page-title">历史记录</h1>
      <p class="text-2">
        每次分析都存在本机浏览器里，点开直接回看，不会再调一次 AI（不花钱）。
      </p>
    </header>

    <section v-if="status === 'loading'" class="card card-pad">
      <p class="text-sm text-3">正在读取本地记录…</p>
    </section>

    <section v-else-if="status === 'error'" class="card card-pad empty">
      <p class="empty-title">读不出来</p>
      <p class="text-sm text-2">{{ errorMsg }}</p>
      <p class="text-xs text-3">
        浏览器隐私模式可能禁用了本地数据库，换一个普通窗口再试。
      </p>
    </section>

    <section v-else-if="list.length === 0" class="card card-pad empty">
      <p class="empty-title">还没有分析记录</p>
      <p class="text-sm text-2">
        去工作台粘一份简历和 JD，点「开始分析」，这里就会出现第一条。
      </p>
      <RouterLink to="/" class="btn btn-primary go">去工作台试试</RouterLink>
    </section>

    <template v-else>
      <p class="text-xs text-3 list-head">共 {{ list.length }} 条 · 按时间从新到旧</p>

      <!-- 一条记录 = 一张卡：左边点进去看详情，右边单独标已投递。
           不能把按钮塞进 RouterLink 里 —— 链接里套按钮，点按钮会顺带跳页 -->
      <article v-for="item in list" :key="item.id" class="row card">
        <RouterLink :to="`/result/${item.id}`" class="row-link">
          <div class="row-main">
            <p class="row-title">
              {{ item.company || '未填写公司' }}
              <span class="text-3">·</span>
              {{ item.position || '未填写岗位' }}
            </p>
            <p class="row-meta text-xs text-3">
              <span>{{ fmtDate(item.createdAt) }}</span>
              <span v-if="item.rewrites.length">改写 {{ item.rewrites.length }} 条</span>
              <span v-if="item.questions.length">题目 {{ item.questions.length }} 道</span>
            </p>
          </div>
          <div class="row-score">
            <span class="score">{{ item.result.score }}</span>
            <span class="text-xs text-3">分</span>
          </div>
        </RouterLink>

        <button
          type="button"
          class="applied"
          :class="{ on: item.applied }"
          @click="toggleApplied(item)"
        >
          {{ item.applied ? '已投递' : '标记已投递' }}
        </button>
      </article>
    </template>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
  padding: 36px 18px;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
}

.go {
  margin-top: 4px;
}

.list-head {
  margin-bottom: -6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}

.row-link {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.row-main {
  min-width: 0;
}

.row-title {
  font-size: 14px;
  font-weight: 500;
  /* 公司名太长时省略，而不是把右边的分数挤走 */
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.row-link:hover .row-title {
  color: var(--c-primary);
}

.row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.row-score {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.score {
  font-size: 20px;
  font-weight: 600;
  color: var(--c-primary);
  font-variant-numeric: tabular-nums;
}

.applied {
  flex: none;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 12px;
  white-space: nowrap;
}

.applied:hover {
  background: #fafafa;
}

.applied.on {
  border-color: transparent;
  background: var(--c-success-weak);
  color: var(--c-success);
}

@media (max-width: 640px) {
  .page-title {
    font-size: 19px;
  }

  /* 窄屏：链接占满一行，按钮换到下一行占满宽度，避免三个元素横着挤 */
  .row {
    flex-wrap: wrap;
  }

  .row-link {
    flex-basis: 100%;
  }

  .applied {
    width: 100%;
    min-height: 34px;
    border-radius: var(--radius-sm);
  }
}
</style>
