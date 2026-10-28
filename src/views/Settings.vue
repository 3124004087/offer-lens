<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'

const store = useWorkspaceStore()
const cleared = ref(false)

function handleClear() {
  store.reset()
  cleared.value = true
  setTimeout(() => (cleared.value = false), 2500)
}
</script>

<template>
  <div class="stack">
    <header class="page-head">
      <h1 class="page-title">设置</h1>
      <p class="text-2">数据、隐私与 AI 配置。</p>
    </header>

    <section class="card card-pad">
      <h2 class="sec-title">数据存储</h2>
      <p class="text-sm text-2 desc">
        简历、JD 和草稿只保存在你自己的浏览器里（localStorage / IndexedDB），
        不会上传到任何服务器。AI 分析时才会把文本发给模型接口。
      </p>
    </section>

    <section class="card card-pad">
      <h2 class="sec-title">AI 配置</h2>
      <p class="text-sm text-2 desc">
        为了防止 API Key 泄露，Key 不放在前端，而是配置在部署平台的
        <code class="code">DEEPSEEK_API_KEY</code> 环境变量里，由
        <code class="code">/api/chat</code> 代理转发。
      </p>
      <p class="text-xs text-3">这一块会在 W2 接入，现在点「开始分析」只用本地关键词能力。</p>
    </section>

    <section class="card card-pad danger">
      <div>
        <h2 class="sec-title">清空本地数据</h2>
        <p class="text-xs text-3 desc">会删除草稿和工作台里的全部输入，且不可恢复。</p>
      </div>
      <div class="danger-action">
        <span v-if="cleared" class="text-xs text-2">已清空</span>
        <button class="btn" @click="handleClear">清空</button>
      </div>
    </section>
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

.sec-title {
  font-size: 14px;
  font-weight: 600;
}

.desc {
  margin-top: 6px;
}

.code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f4f4f5;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--c-text);
}

.danger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.danger-action {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .page-title {
    font-size: 19px;
  }

  .danger {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
