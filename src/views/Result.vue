<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import KeywordTags from '@/components/common/KeywordTags.vue'
import ScoreRing from '@/components/common/ScoreRing.vue'
import DimensionBars from '@/components/common/DimensionBars.vue'
import RewriteCard from '@/components/common/RewriteCard.vue'
import StateBlock from '@/components/common/StateBlock.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAnalysisStore } from '@/stores/analysis'
import { useRewrite } from '@/composables/useRewrite'
import { diffKeywords } from '@/composables/useKeywordExtract'

const route = useRoute()
const store = useWorkspaceStore()
const analysis = useAnalysisStore()

const id = String(route.params.id)

// 改写这条支线独立成 composable：它要流式、要边收边画，跟评分的非流式是两套逻辑。
// list 改名叫 rewrites 是为了下面模板里读起来不像数组下标
const {
  list: rewrites,
  loading: rewriting,
  error: rewriteError,
  run: runRewrite,
  stop: stopRewrite,
  hydrate: hydrateRewrites,
} = useRewrite()

/** 按 id 找不到结果时显示的态：记录被清了、链接被转发，都会走到这 */
const notFound = ref(false)

/**
 * 读本地库是异步的（IndexedDB 没有同步接口）。
 * 没有这个标记的话，页面会先按「什么都没有」渲染一帧：
 * 覆盖率 0%、改写按钮亮着，然后数据到了再跳变 —— 看起来就像页面在抽风。
 */
const restoring = ref(true)

onMounted(async () => {
  // 找不到是正常情况，不是异常：显示空态就好，不要抛错让整页白屏
  const ok = await analysis.restore(id)
  if (!ok) {
    notFound.value = true
  } else {
    // 上次生成过的改写建议从记录里装回来，不再花一次 token
    hydrateRewrites(analysis.current?.rewrites ?? [])
  }
  restoring.value = false
})

/** 标题里的公司/岗位：优先用分析时存下的快照，没有才退回当前草稿 */
const meta = computed(() => {
  const cur = analysis.current
  if (cur) return { company: cur.company, position: cur.position }
  return { company: store.company, position: store.position }
})

/**
 * 这一页该用哪份原文。
 *
 * 优先用记录里的快照，而不是 store 里的草稿：从历史列表点进来时，
 * 草稿可能早被换成了另一份简历，拿它去算覆盖率、去改写，结果是错的。
 * 快照是「那次分析当时的输入」，跟这条记录永远对得上。
 */
const sourceResume = computed(() => analysis.current?.resumeText || store.resumeText)
const sourceJob = computed(() => analysis.current?.jobText || store.jobText)

/**
 * 关键词覆盖率：命中 / (命中 + 缺失)。
 * 本地实时算，不依赖 AI，所以不用存 —— 只要有原文，随时能重算。
 */
const diff = computed(() => diffKeywords(sourceResume.value, sourceJob.value))
const total = computed(() => diff.value.matched.length + diff.value.missing.length)
const rate = computed(() =>
  total.value === 0 ? 0 : Math.round((diff.value.matched.length / total.value) * 100),
)

const rateHint = computed(() => {
  if (total.value === 0)
    return 'JD 里没出现词库中的技术词：可能写得太抽象，也可能岗位不在词库范围内（目前只覆盖前端）'
  if (rate.value >= 80) return '技能栈覆盖得不错，重点补项目深度'
  if (rate.value >= 50) return '基本功够了，缺的这几项面试大概率会问'
  return '差距明显，建议先补齐缺失项再投'
})

/**
 * 改写要读简历和 JD 原文，所以不能只看「有没有分析结果」。
 * 手上既没有记录快照、草稿又是空的（比如直接打开一个别人转发的 id），
 * 点按钮只会请求空字符串，白烧一次 token，所以先挡住。
 */
const canRewrite = computed(
  () => sourceResume.value.trim().length >= 100 && sourceJob.value.trim().length >= 100,
)

/** 一句话说明「现在为什么能点 / 为什么点了没反应」 */
const rewriteHint = computed(() => {
  if (rewriting.value) return '正在逐句改写，收到的条目会先显示出来，大概 15 秒。'
  if (rewrites.value.length > 0) return ''
  if (!canRewrite.value) {
    return '这个页面拿不到完整的简历和 JD（可能是别人分享的链接）。改写要读原文，回工作台重新粘一次。'
  }
  return 'AI 会从简历里挑 3-6 句逐句改写，按 JD 补上缺的关键词。'
})

/**
 * 改写不跟着页面加载自动跑：一进结果页就烧 900 个 token，
 * 失败了还只能刷新重来。按钮触发 = 用户知道自己在花钱，也留了重试的位置。
 */
async function handleRewrite() {
  if (!canRewrite.value || rewriting.value) return
  // missing 是本地算好的差距，直接喂给模型：省 token，输出也更贴 JD
  await runRewrite(sourceResume.value, sourceJob.value, diff.value.missing)

  // 生成完（含中途停止）把已收到的条目写回记录：
  // 不写的话，刷新一次就又白花了这 15 秒和这些 token
  if (rewrites.value.length > 0) {
    await analysis.patch(id, { rewrites: rewrites.value })
  }
}
</script>

<template>
  <div class="stack">
    <header class="page-head">
      <div>
        <RouterLink to="/" class="back text-sm text-2">← 返回工作台</RouterLink>
        <h1 class="page-title">分析结果</h1>
        <p v-if="meta.company || meta.position" class="text-2">
          {{ meta.company || '未填写公司' }} · {{ meta.position || '未填写岗位' }}
        </p>
      </div>
    </header>

    <!-- 读本地库的那几百毫秒：给骨架条，别让页面先渲染成「什么都没有」再跳变 -->
    <StateBlock v-if="restoring" variant="loading" title="正在读取本地记录" />

    <template v-else>
      <!-- AI 分析：有结果就渲染，没有就说清楚为什么没有 -->
      <section v-if="analysis.current" class="card card-pad">
        <div class="sec-head">
          <h2 class="sec-title">AI 深度分析</h2>
          <span class="text-xs text-3">
            {{ new Date(analysis.current.createdAt).toLocaleString('zh-CN') }}
          </span>
        </div>

        <div class="score-row">
          <ScoreRing :score="analysis.current.result.score" />
          <p class="text-sm text-2 summary">{{ analysis.current.result.summary }}</p>
        </div>

        <div class="divider" />

        <DimensionBars :items="analysis.current.result.dimensions" />

        <div class="divider" />

        <!-- 模型偶尔返回整句而不是技能名，标签会撑成两行，先截 16 字 -->
        <KeywordTags
          :matched="analysis.current.result.matched.map((k) => k.slice(0, 16))"
          :missing="analysis.current.result.missing.map((k) => k.slice(0, 16))"
        />
      </section>

      <!-- 记录不在了：整页只留这一块。
           下面「覆盖率 / 改写」都靠 sourceResume 取原文，找不到记录时会退回当前草稿，
           拿别人的简历去算出 0% 或别的百分比，是错的 —— 宁可不显示 -->
      <StateBlock
        v-else-if="notFound"
        variant="empty"
        title="这条记录不在了"
        desc="它只存在你这台电脑的浏览器里。清空过本地数据、换了浏览器或设备，都会读不到。"
      >
        <template #actions>
          <RouterLink to="/" class="btn go-back">回工作台重新分析</RouterLink>
        </template>
      </StateBlock>

      <!-- 这里用独立的 v-if，不接着上面的 v-else-if 往后串：
           上面那条链是「AI 分析 / 空态」二选一，而覆盖率和改写是「有数据就该有」，
           串成一条链的话，有分析结果时反而会把这两块一起跳过 -->
      <template v-if="!notFound">
        <!-- 本地关键词概览：W1 就有的能力，不依赖 AI，只要有原文随时能重算 -->
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

          <KeywordTags :matched="diff.matched" :missing="diff.missing" :extra="diff.extra" />
        </section>

        <!-- 改写：放在覆盖率后面，读起来是「先看差多少 → 再看怎么补」 -->
        <section class="card card-pad">
          <div class="sec-head">
            <h2 class="sec-title">简历改写建议</h2>
            <span v-if="rewrites.length" class="text-xs text-3">{{ rewrites.length }} 条</span>
          </div>

          <p v-if="rewriteHint" class="text-sm text-2 hint">{{ rewriteHint }}</p>

          <!-- 生成中只留「停止」，生成完就不再显示按钮：按钮消失本身就是「已经做过了」的信号 -->
          <div v-if="rewriting || !rewrites.length" class="rw-actions">
            <button v-if="rewriting" class="btn" @click="stopRewrite">停止生成</button>
            <button v-else class="btn btn-primary" :disabled="!canRewrite" @click="handleRewrite">
              生成改写建议
            </button>
          </div>

          <RewriteCard :items="rewrites" :loading="rewriting" :error="rewriteError" />
        </section>

        <!-- 结果页是「诊断」，下一步是「练」。这里只放一个入口，不把题目塞进本页：
             出题是另一次请求，塞进来会让结果页一次烧两份额度 -->
        <section v-if="analysis.current" class="card card-pad next">
          <div class="next-text">
            <h2 class="sec-title">接下来练什么</h2>
            <p class="text-sm text-2">按这份 JD 出 8 道预测题，基础 / 项目 / 场景各一组。</p>
          </div>
          <RouterLink :to="`/questions/${analysis.current.id}`" class="btn next-btn">
            去做面试题 →
          </RouterLink>
        </section>
      </template>
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

.rw-actions {
  margin-top: 12px;
}

.divider {
  height: 1px;
  margin: 16px 0;
  background: var(--c-border);
}

.score-row {
  display: flex;
  align-items: center;
  gap: 20px;
}

.summary {
  margin: 0;
  line-height: 1.6;
}

/* 空态的排版交给 StateBlock，这里只留插槽里那个链接的样式 */
.go-back {
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.next {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.next-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.next-btn {
  flex: none;
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: var(--radius-sm);
  text-decoration: none;
}

@media (max-width: 640px) {
  .page-title {
    font-size: 19px;
  }

  /* 窄屏上下排：一行放不下「说明 + 按钮」，按钮会被挤成两行字 */
  .next {
    flex-direction: column;
    align-items: flex-start;
  }

  .score-row {
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .summary {
    text-align: center;
  }
}
</style>
