<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAnalysisStore } from '@/stores/analysis'
import { listAnalyses } from '@/composables/useLocalDB'

const store = useWorkspaceStore()
const analysisStore = useAnalysisStore()
const cleared = ref(false)

const count = ref(0) // 有几条历史记录
const usage = ref('—') // 占了多少空间，先给占位符，取不到就显示它

// 字节转成人能读的单位。必须先判大小：一条记录才几十 KB，
// 直接除以两次 1024 再 toFixed(1)，会显示成「0.0 MB」，等于没说
function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

// 读记录是异步的，不能在 setup 顶层同步拿，所以放 onMounted
onMounted(async () => {
  count.value = (await listAnalyses()).length

  // estimate() 返回 { usage, quota }，单位是字节。
  // 加 ?. 是因为老浏览器、隐私模式可能根本没有这个方法
  const info = await navigator.storage?.estimate?.()
  if (info?.usage != null) usage.value = formatBytes(info.usage)
})

// 两段式确认：第一下只是「上膛」，3 秒内再点一下才真删。
// 不用 window.confirm —— 它会卡住整个页面线程，样式也不受控制
const armed = ref(false)
const clearError = ref('')
// 两个定时器各存一个变量：共用一个的话第二次赋值会盖掉第一个句柄，
// clearTimeout 就清错对象了
let armTimer: ReturnType<typeof setTimeout> | undefined
let tipTimer: ReturnType<typeof setTimeout> | undefined

async function handleClear() {
  if (!armed.value) {
    armed.value = true
    clearError.value = ''
    armTimer = setTimeout(() => (armed.value = false), 3000)
    return
  }
  clearTimeout(armTimer)
  armed.value = false

  // 必须走 store 的 clearAll：它清库的同时把内存里的 current 置空。
  // 只清库不清内存的话，返回结果页还能看到刚才那份旧分数
  const ok = await analysisStore.clearAll()
  if (!ok) {
    // 清失败却显示「已清空」，等于把问题藏起来，所以这里要真的报出来
    clearError.value = '清空失败，可能是浏览器禁止了本地数据库'
    return
  }

  store.reset() // 草稿跟着一起清
  count.value = 0 // 不写这句，就会出现「库空了、页面还写着 5 条」
  cleared.value = true
  tipTimer = setTimeout(() => (cleared.value = false), 2500)
}

onUnmounted(() => {
  clearTimeout(armTimer)
  clearTimeout(tipTimer)
})
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
      <!-- 说「本站点」而不是「历史记录」：usage 是整个 origin 的总用量，
           还包含 localStorage 里的草稿和浏览器缓存，不只是 IndexedDB -->
      <p class="text-xs text-3 stat">
        当前本机有 {{ count }} 条分析记录，本站点已用空间约 {{ usage }}
      </p>
    </section>

    <section class="card card-pad">
      <h2 class="sec-title">AI 配置</h2>
      <p class="text-sm text-2 desc">
        Key 不放在前端，配置在部署平台的 <code class="code">DEEPSEEK_API_KEY</code>
        环境变量里，由 <code class="code">/api/chat</code> 代理转发。浏览器里拿不到，也就泄露不了。
      </p>
      <!-- 三条链路为什么一个流式两个非流式，是项目里唯一「主动改需求」的地方，
           写进设置页等于给自己留了张提词卡 -->
      <ul class="chain">
        <li><b>评分</b>：非流式，一次返回完整 JSON，2–3 秒出分</li>
        <li><b>改写</b>：流式，边生成边显示，看着有反馈</li>
        <li><b>出题</b>：非流式，8 道题是结构化数据，等齐再渲染</li>
      </ul>
      <p class="text-xs text-3 note">
        评分和出题不走流式，是因为 JSON 没法增量解析：拿到半截
        <code class="code">{"score": 62, "dimensions": [</code>
        是 parse 不出来的，只能等全部生成完——那流式就白流了。所以拆成「评分非流式 + 改写流式」两条并行。
      </p>
    </section>

    <section class="card card-pad danger">
      <div>
        <h2 class="sec-title">清空本地数据</h2>
        <p class="text-xs text-3 desc">
          会删掉工作台的草稿、以及全部历史分析记录（评分 / 改写 / 面试题都在里面），不可恢复。
        </p>
        <p v-if="clearError" class="text-xs err">{{ clearError }}</p>
      </div>
      <div class="danger-action">
        <span v-if="cleared" class="text-xs text-2">已清空</span>
        <button class="btn" :class="{ 'btn-armed': armed }" @click="handleClear">
          {{ armed ? '再点一次确认' : '清空' }}
        </button>
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

.stat {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--c-border);
}

.chain {
  margin-top: 10px;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--c-text-2);
}

.chain b {
  color: var(--c-text);
  font-weight: 600;
}

.note {
  margin-top: 10px;
  line-height: 1.7;
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

.err {
  margin-top: 6px;
  color: var(--c-danger);
}

/* 上膛状态：颜色变红，让用户知道这一下点了就真删了 */
.btn-armed {
  border-color: var(--c-danger);
  color: var(--c-danger);
  background: var(--c-danger-weak);
}

.btn-armed:hover:not(:disabled) {
  background: #fee2e2;
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
