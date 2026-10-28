<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import TextPanel from '@/components/common/TextPanel.vue'
import KeywordTags from '@/components/common/KeywordTags.vue'
import { useWorkspaceStore } from '@/stores/workspace'
import {
  SAMPLE_COMPANY,
  SAMPLE_JOB,
  SAMPLE_POSITION,
  SAMPLE_RESUME,
} from '@/data/samples'

const store = useWorkspaceStore()
const router = useRouter()

const hasAnyText = computed(
  () => store.resumeText.trim().length > 0 || store.jobText.trim().length > 0,
)

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
