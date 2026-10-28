<script setup lang="ts">
withDefaults(
  defineProps<{
    matched: string[]
    missing: string[]
    extra?: string[]
  }>(),
  { extra: () => [] },
)
</script>

<template>
  <div class="kw">
    <div class="kw-group">
      <span class="kw-label">命中 {{ matched.length }}</span>
      <div class="kw-tags">
        <span v-for="k in matched" :key="k" class="tag tag-success">{{ k }}</span>
        <span v-if="!matched.length" class="text-xs text-3">暂无</span>
      </div>
    </div>

    <div class="kw-group">
      <span class="kw-label">缺失 {{ missing.length }}</span>
      <div class="kw-tags">
        <span v-for="k in missing" :key="k" class="tag tag-danger">{{ k }}</span>
        <span v-if="!missing.length" class="text-xs text-3">暂无</span>
      </div>
    </div>

    <div v-if="extra.length" class="kw-group">
      <span class="kw-label">简历多出 {{ extra.length }}</span>
      <div class="kw-tags">
        <span v-for="k in extra" :key="k" class="tag tag-neutral">{{ k }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kw {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kw-group {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.kw-label {
  flex-shrink: 0;
  width: 84px;
  padding-top: 2px;
  font-size: 12px;
  color: var(--c-text-2);
}

.kw-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (max-width: 640px) {
  .kw-group {
    flex-direction: column;
    gap: 6px;
  }

  .kw-label {
    width: auto;
    padding-top: 0;
  }
}
</style>
