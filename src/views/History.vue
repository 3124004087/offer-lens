<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="stack">
    <header class="page-head">
      <h1 class="page-title">历史记录</h1>
      <p class="text-2">每次分析都存本地，可回看、可标记「已投递」。</p>
    </header>

    <section class="card card-pad empty">
      <p class="empty-title">还没有分析记录</p>
      <p class="text-sm text-2">
        这块会在 <span class="tag tag-neutral">W3</span> 接入 IndexedDB 后完成。
      </p>
      <RouterLink to="/" class="btn btn-primary go">去工作台试试</RouterLink>
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

@media (max-width: 640px) {
  .page-title {
    font-size: 19px;
  }
}
</style>
