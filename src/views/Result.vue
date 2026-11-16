<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import KeywordTags from '@/components/common/KeywordTags.vue'
import ScoreRing from '@/components/common/ScoreRing.vue'
import DimensionBars from '@/components/common/DimensionBars.vue'
import RewriteCard from '@/components/common/RewriteCard.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAnalysisStore } from '@/stores/analysis'
import { useRewrite } from '@/composables/useRewrite'

const route = useRoute()
const store = useWorkspaceStore()
const analysis = useAnalysisStore()

// 改写这条支线独立成 composable：它要流式、要边收边画，跟评分的非流式是两套逻辑。
// list 改名叫 rewrites 是为了下面模板里读起来不像数组下标
const {
  list: rewrites,
  loading: rewriting,
  error: rewriteError,
  run: runRewrite,
  stop: stopRewrite,
} = useRewrite()

/** 按 id 找不到结果时显示的态：别人分享的链接、关掉标签页后再打开，都会走到这 */
const notFound = ref(false)

onMounted(() => {
  // 路由参数的类型是 string | string[]（同一参数重复出现才会是数组），统一转成字符串
  const id = String(route.params.id)
  // 找不到是正常情况，不是异常：显示空态就好，不要抛错让整页白屏
  if (!analysis.restore(id)) notFound.value = true
})

/** 标题里的公司/岗位：优先用分析时存下的快照，没有才退回当前草稿 */
const meta = computed(() => {
  const cur = analysis.current
  if (cur) return { company: cur.company, position: cur.position }
  return { company: store.company, position: store.position }
})

/** 关键词覆盖率：命中 / (命中 + 缺失)。本地实时算，不依赖 AI，所以不用存 */
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

/**
 * 改写要读简历和 JD 原文，所以不能只看「有没有分析结果」。
 * 从别人分享的链接进来时，store 是空的（原文没跟着 URL 走），
 * 这时候点按钮只会请求一个空字符串，白烧一次 token，所以先挡住。
 */
const canRewrite = computed(
  () => store.resumeText.trim().length >= 100 && store.jobText.trim().length >= 100,
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
  await runRewrite(store.resumeText, store.jobText, store.keywordDiff.missing)
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

    <section v-else-if="notFound" class="card card-pad empty">
      <h2 class="sec-title">这个结果不在了</h2>
      <p class="text-sm text-2">
        分析结果只存在当前标签页里，刷新还在，关掉标签页或换设备就找不回来。
      </p>
      <RouterLink to="/" class="btn go-back">回工作台重新分析</RouterLink>
    </section>

    <!-- 本地关键词概览：W1 就有的能力，不依赖 AI，刷新照样算得出来 -->
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
