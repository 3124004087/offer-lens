<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="stack">
    <header class="page-head">
      <RouterLink to="/" class="back text-sm text-2">← 返回工作台</RouterLink>
      <h1 class="page-title">面试题预测</h1>
      <p class="text-2">按 JD 生成 8 道题，分「基础 / 项目 / 场景」三类。</p>
    </header>

    <section class="card card-pad empty">
      <p class="empty-title">还没接入</p>
      <p class="text-sm text-2">
        这个页面会在 <span class="tag tag-neutral">W3</span> 完成。届时这里有：
      </p>
      <ul class="list">
        <li>三个 Tab 分组切换</li>
        <li>每道题可折叠查看答题思路</li>
        <li>「会 / 不会」自评，顶部显示掌握进度</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.back {
  margin-bottom: 2px;
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
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--c-text-2);
}
</style>
