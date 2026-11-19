<script setup lang="ts">
// views/History.vue
// 历史记录页的职责很单一：从 IndexedDB 取列表 → 渲染 → 点进去回看。
// 它**不发任何 AI 请求**，所以反复打开不花钱；回看用的是记录里存好的快照。
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAnalysisStore } from '@/stores/analysis'
import StateBlock from '@/components/common/StateBlock.vue'
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

/** 哪一行的删除按钮已经按了第一下、正在等第二下。null = 没有任何一行在等 */
const confirmId = ref<string | null>(null)

/** 删除失败的提示。删除失败必须让用户看见，不能悄悄什么都没发生 */
const delError = ref('')

/**
 * 删除要按两下。
 *
 * 第一下只是「上膛」：把这一行的 id 记进 confirmId，按钮文案变成「确认删除」，数据不动。
 * 第二下才真的删。为什么不做成「点一下就删 + 弹窗问一次」：弹窗会打断操作，
 * 而且刚点完就弹出来，很容易顺手点掉「确定」—— 两道门槛反而比一道更松。
 *
 * 和上面「标记已投递」的关键差别：那边是乐观更新（先改界面再写库），
 * 这边必须等 remove 返回 true 才动列表 —— 删错了没法撤回。
 */
async function handleDelete(item: SavedAnalysis) {
  // 第一下：只标记「哪一行在等确认」，不动数据
  if (confirmId.value !== item.id) {
    confirmId.value = item.id
    delError.value = ''
    return
  }

  // 第二下：写库。删成功才从列表里拿掉
  const ok = await analysis.remove(item.id)
  if (!ok) {
    delError.value = '删除失败，可能是浏览器不让写本地数据'
    confirmId.value = null
    return
  }

  // filter（筛选）：留下 id 不等于这一条的，等于把这条剔掉。
  // 不直接用 splice：filter 会造一个新数组，Vue 一定能察觉到变化
  list.value = list.value.filter((x) => x.id !== item.id)
  confirmId.value = null
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

    <!-- 三种态交给 StateBlock 画，这里只负责判断该用哪一种 -->
    <StateBlock v-if="status === 'loading'" variant="loading" />

    <StateBlock
      v-else-if="status === 'error'"
      variant="error"
      title="读不出来"
      :desc="errorMsg"
      hint="浏览器隐私模式可能禁用了本地数据库，换一个普通窗口再试。"
    />

    <StateBlock
      v-else-if="list.length === 0"
      variant="empty"
      title="还没有分析记录"
      desc="去工作台粘一份简历和 JD，点「开始分析」，这里就会出现第一条。"
    >
      <template #actions>
        <RouterLink to="/" class="btn btn-primary go">去工作台试试</RouterLink>
      </template>
    </StateBlock>

    <template v-else>
      <p class="text-xs text-3 list-head">共 {{ list.length }} 条 · 按时间从新到旧</p>
      <p v-if="delError" class="text-xs del-error">{{ delError }}</p>

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

        <div class="row-actions">
          <button
            type="button"
            class="applied"
            :class="{ on: item.applied }"
            @click="toggleApplied(item)"
          >
            {{ item.applied ? '已投递' : '标记已投递' }}
          </button>

          <button
            type="button"
            class="del"
            :class="{ arming: confirmId === item.id }"
            @click="handleDelete(item)"
          >
            {{ confirmId === item.id ? '确认删除' : '删除' }}
          </button>
        </div>
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

.row-actions {
  flex: none;
  display: flex;
  gap: 6px;
}

.del {
  flex: none;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  background: var(--c-surface);
  color: var(--c-text-3);
  font-size: 12px;
  white-space: nowrap;
}

.del:hover {
  border-color: var(--c-danger);
  color: var(--c-danger);
}

/* 上膛状态：红底白字。让人一眼看出「这次点下去就没了」 */
.del.arming {
  border-color: transparent;
  background: var(--c-danger);
  color: #fff;
}

.del-error {
  color: var(--c-danger);
  margin-bottom: -2px;
}

@media (max-width: 640px) {
  .page-title {
    font-size: 19px;
  }

  /* 窄屏：链接占满一行，两个按钮换到下一行各占一半，
     避免三个元素横着挤成一堆小字 */
  .row {
    flex-wrap: wrap;
  }

  .row-link {
    flex-basis: 100%;
  }

  .row-actions {
    flex-basis: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .applied,
  .del {
    width: 100%;
    min-height: 34px;
    border-radius: var(--radius-sm);
  }
}
</style>
