<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import QuestionCard from '@/components/common/QuestionCard.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAnalysisStore } from '@/stores/analysis'
import { useQuestions } from '@/composables/useQuestions'
import { diffKeywords } from '@/composables/useKeywordExtract'
import type { Question } from '@/types'

const route = useRoute()
const store = useWorkspaceStore()
const analysis = useAnalysisStore()

// list / loading / error 都来自 composable，页面不再另存一份
const { list, loading, error, masteredCount, run, setMastered, hydrate } = useQuestions()

const id = String(route.params.id)

/** 这个 id 找不回分析结果：记录被清了、链接被转发，都会走到这 */
const notFound = ref(false)

/** 读本地库是异步的，先占住页面，别让它先渲染成「还没出过题」再跳变 */
const restoring = ref(true)

onMounted(async () => {
  const ok = await analysis.restore(id)
  if (!ok) {
    notFound.value = true
  } else {
    // 上次出过的题连自评一起装回来，刷新不用重新生成（省一笔 token）
    hydrate(analysis.current?.questions ?? [])
  }
  restoring.value = false
})

/**
 * 整页只有这一个状态出口，模板里只判 view。
 *
 * 没有另设一个 status ref 手动同步，是因为状态源头本来就在 composable 里，
 * 再复制一份必然出现「忘了改」的时刻（比如报错时忘了把 loading 置回）。
 * 用 computed 从源头算，同一时刻天然只可能是一个值 —— 这才是那个「一个字段」真正要保证的事。
 */
const view = computed(() => {
  if (notFound.value) return 'gone'
  if (loading.value) return 'loading'
  if (error.value) return 'error'
  if (list.value.length > 0) return 'success'
  return 'idle'
})

/**
 * 出题要读原文。
 * 优先用记录里的快照：从历史列表进来时，当前草稿可能已经换成另一份简历了，
 * 拿它出题，题目跟这条记录对不上。
 */
const sourceResume = computed(() => analysis.current?.resumeText || store.resumeText)
const sourceJob = computed(() => analysis.current?.jobText || store.jobText)

const canGenerate = computed(
  () => sourceResume.value.trim().length >= 100 && sourceJob.value.trim().length >= 100,
)

const idleHint = computed(() => {
  if (!canGenerate.value) {
    return '这个页面拿不到完整的简历和 JD（可能是别人分享的链接）。出题要读原文，回工作台重新粘一次再分析。'
  }
  return '按这份 JD 出 8 道题：基础 3 道、项目 3 道、场景 2 道，大概 6 秒。'
})

const meta = computed(() => {
  const cur = analysis.current
  if (!cur) return ''
  return `${cur.company || '未填写公司'} · ${cur.position || '未填写岗位'}`
})

const TABS = [
  { key: 'basic', label: '基础题' },
  { key: 'project', label: '项目题' },
  { key: 'scene', label: '场景题' },
] as const

type TabKey = (typeof TABS)[number]['key']

const activeTab = ref<TabKey>('basic')

/** 三个分组一次算好。写在模板里写三次 filter，每次渲染都要重跑一遍 */
const grouped = computed(() => ({
  basic: list.value.filter((q) => q.category === 'basic'),
  project: list.value.filter((q) => q.category === 'project'),
  scene: list.value.filter((q) => q.category === 'scene'),
}))

/** 每个 Tab 上的「已掌握 / 总数」 */
function countOf(arr: Question[]) {
  return { done: arr.filter((q) => q.mastered).length, total: arr.length }
}

const stats = computed(() => ({
  basic: countOf(grouped.value.basic),
  project: countOf(grouped.value.project),
  scene: countOf(grouped.value.scene),
}))

/** 当前 Tab 要显示的题 */
const shown = computed(() => grouped.value[activeTab.value])

const pct = computed(() =>
  list.value.length === 0 ? 0 : Math.round((masteredCount.value / list.value.length) * 100),
)

/**
 * 展开状态放这里（父组件），不放卡片里。
 * Tab 是用 v-if 切换的，卡片会被卸载重建 —— 状态留在卡片里，一切 Tab 就全收起来了。
 */
const openIds = ref<string[]>([])

function toggleOpen(qid: string) {
  openIds.value = openIds.value.includes(qid)
    ? openIds.value.filter((x) => x !== qid)
    : [...openIds.value, qid]
}

async function handleGenerate() {
  if (!canGenerate.value || loading.value) return
  // 换一批时 id 是「下标 + 分类」，很可能和上一批撞上，
  // 不先清空的话，上一批展开的那几道会把新的一批也带成展开状态
  openIds.value = []
  // missing 用本地词典现算，不依赖 store 里那份草稿（可能已经是别的简历了）
  const missing = diffKeywords(sourceResume.value, sourceJob.value).missing
  await run(sourceResume.value, sourceJob.value, missing)

  // 生成成功才写库：失败时 list 是空的，写进去等于把上一批题抹掉
  if (list.value.length > 0) {
    await analysis.patch(id, { questions: list.value })
  }
}

/**
 * 自评：先改界面，再落库。
 * 落库失败不弹错：自评只是自己看的标记，写不进去顶多刷新后回到「还未标」，
 * 为这个弹个红字反而更吓人。
 */
async function handleMastered(qid: string, value: boolean) {
  setMastered(qid, value)
  await analysis.patch(id, { questions: list.value })
}
</script>

<template>
  <div class="stack">
    <header class="page-head">
      <div>
        <RouterLink :to="`/result/${id}`" class="back text-sm text-2">← 返回分析结果</RouterLink>
        <h1 class="page-title">面试题预测</h1>
        <p v-if="meta" class="text-2">{{ meta }}</p>
      </div>
    </header>

    <!-- 读本地库的那几百毫秒，先占个位 -->
    <section v-if="restoring" class="card card-pad">
      <p class="text-sm text-3">正在读取本地记录…</p>
    </section>

    <!-- 找不到结果 -->
    <section v-else-if="view === 'gone'" class="card card-pad empty">
      <h2 class="sec-title">这条记录不在了</h2>
      <p class="text-sm text-2">
        它只存在你这台电脑的浏览器里。清空过本地数据、换了浏览器或设备，都会读不到，出题也就没有原文可读。
      </p>
      <RouterLink to="/" class="btn go-back">回工作台重新分析</RouterLink>
    </section>

    <template v-else>
      <!-- 掌握进度：只在有题时出现，没题时显示 0/0 是噪音 -->
      <section v-if="view === 'success'" class="card card-pad">
        <div class="sec-head">
          <h2 class="sec-title">掌握进度</h2>
          <span class="pct">{{ masteredCount }} / {{ list.length }}</span>
        </div>
        <div class="bar">
          <div class="bar-fill" :style="{ width: `${pct}%` }" />
        </div>
        <p class="text-sm text-2 hint">
          会 / 不会只是给自己做标记，不影响评分。切 Tab、刷新、关掉浏览器都不会丢。
        </p>
      </section>

      <section class="card card-pad">
        <div class="sec-head">
          <h2 class="sec-title">面试题</h2>
          <span v-if="view === 'success'" class="text-xs text-3">{{ list.length }} 道</span>
        </div>

        <!-- 没题的时候：一句说明 + 一个按钮 -->
        <template v-if="view !== 'success'">
          <p v-if="view === 'error'" class="text-sm err">{{ error }}</p>
          <p v-else class="text-sm text-2 hint">{{ idleHint }}</p>

          <div class="actions">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!canGenerate || loading"
              @click="handleGenerate"
            >
              {{ loading ? '正在生成…' : view === 'error' ? '重试' : '生成 8 道面试题' }}
            </button>
          </div>
        </template>

        <!-- 有题：Tab + 列表 -->
        <template v-else>
          <div class="tabs">
            <button
              v-for="t in TABS"
              :key="t.key"
              type="button"
              class="tab"
              :class="{ 'tab--on': activeTab === t.key }"
              @click="activeTab = t.key"
            >
              {{ t.label }}
              <span class="tab-n">{{ stats[t.key].done }}/{{ stats[t.key].total }}</span>
            </button>
          </div>

          <div class="list">
            <QuestionCard
              v-for="q in shown"
              :key="q.id"
              :item="q"
              :open="openIds.includes(q.id)"
              @toggle="toggleOpen"
              @mastered="handleMastered"
            />
            <!-- 某一类可能一道都没有：模型偶尔 2 道场景题都写成了 basic -->
            <p v-if="shown.length === 0" class="text-sm text-3">这一类这次没出题，切别的 Tab 看看。</p>
          </div>

          <div class="actions bottom">
            <button type="button" class="btn" :disabled="!canGenerate" @click="handleGenerate">
              换一批
            </button>
          </div>
        </template>
      </section>
    </template>
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
  gap: 12px;
  margin-bottom: 10px;
}

.sec-title {
  font-size: 14px;
  font-weight: 600;
}

.pct {
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

.err {
  color: var(--c-danger);
}

.actions {
  margin-top: 12px;
}

.actions.bottom {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--c-border);
}

.tabs {
  display: flex;
  gap: 6px;
  margin: 12px 0 10px;
}

.tab {
  /* flex: 1 让三个 Tab 等宽铺满，窄屏也不用横向滚动 */
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.tab--on {
  border-color: var(--c-primary);
  background: var(--c-primary-weak);
  color: var(--c-primary);
  font-weight: 500;
}

.tab-n {
  margin-left: 4px;
  font-size: 11px;
  color: var(--c-text-3);
}

.tab--on .tab-n {
  color: var(--c-primary);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.go-back {
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

@media (max-width: 640px) {
  .page-title {
    font-size: 19px;
  }

  .tab {
    font-size: 12px;
  }

  .tab-n {
    display: block;
    margin: 1px 0 0;
  }
}
</style>
