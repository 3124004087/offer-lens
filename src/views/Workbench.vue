<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TextPanel from '@/components/common/TextPanel.vue'
import KeywordTags from '@/components/common/KeywordTags.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAnalysisStore } from '@/stores/analysis'
import { useScore } from '@/composables/useScore'
import {
  SAMPLE_COMPANY,
  SAMPLE_JOB,
  SAMPLE_POSITION,
  SAMPLE_RESUME,
} from '@/data/samples'

const store = useWorkspaceStore()
const analysis = useAnalysisStore()
const router = useRouter()

const hasAnyText = computed(
  () => store.resumeText.trim().length > 0 || store.jobText.trim().length > 0,
)

// 评分逻辑在 useScore 里，这个页面只负责「什么时候调、调完去哪」
// W2D2 的流式试跑区已删（那个只用来肉眼确认逐字输出），useAIStream.ts 文件保留，W3 改写要用
const { result, loading, error, run } = useScore()

/** 一键填入示例数据，方便第一次打开的人先看效果 */
function fillSample() {
  store.resumeText = SAMPLE_RESUME
  store.jobText = SAMPLE_JOB
  store.company = SAMPLE_COMPANY
  store.position = SAMPLE_POSITION
}

/**
 * 主链路：读内容 → 请求评分 → 存结果 → 跳 /result/:id
 *
 * 为什么失败不跳：run 内部已经把错误接住了（失败时 result 为 null、error 有内容）。
 * 这时候跳过去，用户只看到「结果不在了」的空态，根本不知道是 Key 错了还是网断了。
 * 错误必须留在当前页，就显示在按钮旁边。
 */
async function handleAnalyze() {
  if (!store.canAnalyze || loading.value) return

  await run(store.resumeText, store.jobText)
  if (!result.value) return

  // 存完拿到 id，URL 只带这个 id，数据落在 IndexedDB 里（关掉标签页也还在）。
  // await 是必须的：IndexedDB 写盘是异步的，不等就跳走的话，
  // 结果页按 id 去读可能读不到（事务还没结束）
  const id = await analysis.saveScore(result.value, {
    company: store.company,
    position: store.position,
    resumeText: store.resumeText,
    jobText: store.jobText,
  })
  router.push(`/result/${id}`)
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

    <section class="card card-pad action">
      <div class="action-info">
        <p v-if="error" class="text-sm err">{{ error }}</p>
        <p v-else-if="store.disabledReason" class="text-sm text-2">{{ store.disabledReason }}</p>
        <p v-else class="text-sm text-2">
          已就绪：命中 {{ store.keywordDiff.matched.length }} 项，缺失
          {{ store.keywordDiff.missing.length }} 项
        </p>
        <p class="text-xs text-3">
          {{ loading ? 'AI 正在读简历和 JD，大概 3-5 秒' : '内容会自动保存在本地，刷新不丢' }}
        </p>
      </div>
      <button
        class="btn btn-primary"
        :disabled="!store.canAnalyze || loading"
        @click="handleAnalyze"
      >
        {{ loading ? '分析中…' : '开始分析' }}
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
