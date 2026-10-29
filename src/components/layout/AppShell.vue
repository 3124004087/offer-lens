<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

/** 顶部导航（结果页、面试题页属于二级页，不放进导航） */
const navs = [
  { name: 'workbench', label: '工作台', to: '/' },
  { name: 'history', label: '历史记录', to: '/history' },
  { name: 'settings', label: '设置', to: '/settings' },
]

const activeName = computed(() => route.name as string)
</script>

<template>
  <div class="shell">
    <header class="shell-header">
      <div class="container header-inner">
        <RouterLink to="/" class="brand">
          <span class="brand-mark">OL</span>
          <span class="brand-name">OfferLens</span>
        </RouterLink>

        <nav class="nav">
          <RouterLink
            v-for="item in navs"
            :key="item.name"
            :to="item.to"
            class="nav-item"
            :class="{ active: activeName === item.name }"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>
    </header>

    <main class="shell-main">
      <div class="container">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </main>

    <footer class="shell-footer">
      <div class="container text-xs text-3">
        <RouterLink to="/about" class="about-link">关于</RouterLink>
        OfferLens · 简历 × JD 智能匹配 · 数据全部保存在你的浏览器本地
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.shell-header {
  position: sticky;
  top: 0;
  z-index: 10;
  height: var(--header-h);
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: saturate(180%) blur(8px);
  border-bottom: 1px solid var(--c-border);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--c-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.nav {
  display: flex;
  gap: 4px;
}

.nav-item {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  color: var(--c-text-2);
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: #f4f4f5;
  color: var(--c-text);
}

.nav-item.active {
  background: var(--c-primary-weak);
  color: var(--c-primary);
  font-weight: 500;
}

.shell-main {
  flex: 1;
  padding: 28px 0 48px;
}

.shell-footer {
  padding: 18px 0 28px;
  text-align: center;
}

.about-link {
  margin-right: 12px;
  color: var(--c-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.about-link:hover {
  color: var(--c-primary-dark);
}

@media (max-width: 640px) {
  .header-inner {
    gap: 12px;
  }

  .brand-name {
    display: none;
  }

  .shell-main {
    padding: 18px 0 36px;
  }
}
</style>
