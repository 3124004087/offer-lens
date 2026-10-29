<script setup lang="ts">
// 纯静态数据，不需要响应式，别用 ref 多包一层
const stack = [
  { name: 'Vue 3', why: '组合式 API，逻辑按功能聚合' },
  { name: 'TypeScript', why: '只做数据结构和 props 约束' },
  { name: 'Vite', why: '冷启动快，构建时按路由拆分' },
  { name: 'Pinia', why: '只存跨路由共享的三份状态' },
]
</script>

<template>
  <div class="about">
    <h1 class="title">关于</h1>
    <p class="desc">一个为了搞清楚「简历到底差在哪」而写的工具。</p>
    <ul class="list">
      <li v-for="(item, i) in stack" :key="item.name" class="item">
        <span class="idx">{{ i + 1 }}</span>
        <strong>{{ item.name }}</strong>
        <span class="text-2">{{ item.why }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.about { max-width: 640px; }
.title { font-size: 22px; margin-bottom: 6px; }
.desc { color: var(--c-text-2); margin-bottom: 20px; }
.list { display: flex; flex-direction: column; gap: 10px; }
.item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border: 1px solid var(--c-border);
  border-radius: var(--radius); background: var(--c-surface);
}
.idx {
  width: 20px; height: 20px; display: grid; place-items: center;
  border-radius: 50%; background: var(--c-primary-weak);
  color: var(--c-primary); font-size: 11px;
}
</style>
