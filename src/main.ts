import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useWorkspaceStore } from './stores/workspace'

import './styles/variables.css'
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// —— 草稿兜底落盘 ——
// 草稿是防抖 2 秒写的，用户打完字立刻关页面会丢掉这 2 秒。
// pagehide 覆盖关闭标签 / 前进后退，visibilitychange 覆盖切后台、锁屏，
// 两个一起才能同时管住桌面和手机。
// 不用 beforeunload：iOS Safari 经常不触发，而且它的回调里只允许同步操作。
const workspace = useWorkspaceStore(pinia)

window.addEventListener('pagehide', () => {
  workspace.flushDraft()
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    workspace.flushDraft()
  }
})

app.mount('#app')
