<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import TextPanel from '@/components/common/TextPanel.vue'
import KeywordTags from '@/components/common/KeywordTags.vue'
import StreamBlock from '@/components/common/StreamBlock.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAIStream } from '@/composables/useAIStream'
import { SCORE_SYSTEM, buildScoreUser } from '@/prompts/score'
import { safeParseJSON } from '@/utils/safeParseJSON'
import type { ScoreResult } from '@/types'
import {
  SAMPLE_COMPANY,
  SAMPLE_JOB,
  SAMPLE_POSITION,
  SAMPLE_RESUME,
} from '@/data/samples'

const store = useWorkspaceStore()
const router = useRouter()

// W2D2 临时试跑区：只为肉眼确认「字是一个一个出来的」，D5 接进结果页后删掉
const { text, loading, error, run } = useAIStream()

function tryStream() {
  run({
    system: '你是前端面试官，只输出点评，不要客套话。',
    // 截 300 字，省 token 也省时间，验证流式不需要长文
    user: `用 80 字点评这段简历：${store.resumeText.slice(0, 300)}`,
  })
}

const hasAnyText = computed(
  () => store.resumeText.trim().length > 0 || store.jobText.trim().length > 0,
)

// W2D4 临时试跑区：只为确认分数能真的取出来，D5 做 ScoreRing 时搬进 useScore
const score = ref<number | null>(null)
const scoring = ref(false)
const scoreErr = ref<string | null>(null)

async function doScore() {
  scoring.value = true
  scoreErr.value = null
  score.value = null

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: SCORE_SYSTEM,
        user: buildScoreUser(store.resumeText, store.jobText),
        // 非流式：评分结果要一次拿全。半截 JSON 是 parse 不出来的，
        // 流式在这里没有意义（这也是排期文档 D4 改需求的原因）
        stream: false,
        // 让代理补上 response_format: json_object
        json: true,
        // 评分要稳定，温度压低；0.2 比默认 0.3 更不容易每次给不同分数
        temperature: 0.2,
      }),
    })

    // 代理失败时返回的是 { error, detail }，先看状态码再读 body
    if (!res.ok) {
      const info = await res.json().catch(() => null)
      throw new Error(`HTTP ${res.status} ${String(info?.detail ?? '').slice(0, 60)}`)
    }

    // 关键：非流式分支是把上游原始响应原样透传回来的，
    // 结构是 { choices: [{ message: { content: "..." } }] }，
    // content 才是模型吐的那段文字，不是 score 对象本身
    const data = await res.json()
    const content: string = data.choices?.[0]?.message?.content ?? ''

    const obj = safeParseJSON<ScoreResult>(content)
    if (!obj) throw new Error('模型返回的不是合法 JSON')

    // 解析成功 ≠ 数据可用：模型可能给 "80分" / 800 / -5。
    // 一律收敛成 0-100 的整数，宁可显示 0 也不让页面出现 NaN
    const n = Number(obj.score)
    score.value = Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0
  } catch (e: any) {
    scoreErr.value = e?.message ?? '评分失败'
  } finally {
    // 和 useAIStream 一个道理：无论成败都要关 loading，否则按钮永远卡在「评分中」
    scoring.value = false
  }
}

/** 一键填入示例数据，方便第一次打开的人先看效果 */
function fillSample() {
  store.resumeText = SAMPLE_RESUME
  store.jobText = SAMPLE_JOB
  store.company = SAMPLE_COMPANY
  store.position = SAMPLE_POSITION
}

function handleAnalyze() {
  if (!store.canAnalyze) return
  // W1 阶段：只有本地关键词结果，AI 分析在 W2 接入
  router.push('/result/local')
}
</script>

<template>
  <div class="stack">
    <header class="page-head">
      <div class="head-text">
        <h1 class="page-title">工作台</h1>
        <p class="text-2">
          左侧贴简历，右侧贴 JD。先看本地算出的关键词差异，再让 AI 做深度分析。
        </p>
      </div>

      <div class="head-actions">
        <button class="btn btn-sm" @click="fillSample">填入示例</button>
        <button class="btn btn-sm" :disabled="!hasAnyText" @click="store.reset()">清空</button>
      </div>
    </header>

    <div class="grid">
      <TextPanel
        v-model="store.resumeText"
        title="我的简历"
        subtitle="建议包含：技能、项目经历、实习/竞赛"
        placeholder="把你的简历全文粘贴到这里…"
      />

      <div class="col">
        <section class="card card-pad meta">
          <label class="field">
            <span class="field-label">公司</span>
            <input v-model="store.company" class="input" placeholder="如：字节跳动" />
          </label>
          <label class="field">
            <span class="field-label">岗位</span>
            <input v-model="store.position" class="input" placeholder="如：前端开发实习生" />
          </label>
        </section>

        <TextPanel
          v-model="store.jobText"
          title="目标岗位 JD"
          subtitle="从招聘 App 复制全文，包含「任职要求」"
          placeholder="把 JD 全文粘贴到这里…"
        />
      </div>
    </div>

    <section class="card card-pad">
      <div class="section-head">
        <h2 class="section-title">关键词差异</h2>
        <span class="text-xs text-3">本地词典计算，实时更新，不消耗 AI</span>
      </div>

      <KeywordTags
        v-if="hasAnyText"
        :matched="store.keywordDiff.matched"
        :missing="store.keywordDiff.missing"
        :extra="store.keywordDiff.extra"
      />
      <p v-else class="text-sm text-3">还什么都没填。先粘一段内容试试。</p>
    </section>

    <section class="card card-pad">
      <div class="section-head">
        <h2 class="section-title">流式试跑（临时）</h2>
        <button class="btn btn-sm" :disabled="loading || !store.resumeText" @click="tryStream">
          {{ loading ? '生成中…' : '试跑' }}
        </button>
      </div>

      <p v-if="error" class="text-sm err">{{ error }}</p>
      <StreamBlock :text="text" :loading="loading" />
    </section>

    <section class="card card-pad">
      <div class="section-head">
        <h2 class="section-title">评分试跑（临时）</h2>
        <button class="btn btn-sm" :disabled="scoring || !store.canAnalyze" @click="doScore">
          {{ scoring ? '评分中…' : '试跑评分' }}
        </button>
      </div>

      <p v-if="scoreErr" class="text-sm err">{{ scoreErr }}</p>
      <p v-else-if="score !== null" class="text-sm">得分：{{ score }}</p>
      <p v-else class="text-sm text-3">点上面的按钮，3-5 秒出分。</p>
    </section>

    <section class="card card-pad action">
      <div class="action-info">
        <p v-if="store.disabledReason" class="text-sm text-2">{{ store.disabledReason }}</p>
        <p v-else class="text-sm text-2">
          已就绪：命中 {{ store.keywordDiff.matched.length }} 项，缺失
          {{ store.keywordDiff.missing.length }} 项
        </p>
        <p class="text-xs text-3">内容会自动保存在本地，刷新不丢</p>
      </div>
      <button class="btn btn-primary" :disabled="!store.canAnalyze" @click="handleAnalyze">
        开始分析
      </button>
    </section>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.head-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.head-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-sm {
  min-height: 32px;
  padding: 0 12px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 12px;
  color: var(--c-text-2);
}

.input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  color: var(--c-text);
  font-size: 13px;
}

.input:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-weak);
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
}

.err {
  color: var(--c-danger);
}

.action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.action-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

@media (max-width: 640px) {
  .page-title {
    font-size: 19px;
  }

  .action {
    flex-direction: column;
    align-items: stretch;
  }

  .action .btn {
    min-height: 44px;
  }
}
</style>
