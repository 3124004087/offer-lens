// composables/useScore.ts
// 从 Workbench 里那段临时 doScore 抽出来，原因有两个：
//   1. D6 串主链路时 Result 页也要重新渲染分数，不抽就得复制 50 行，改一处漏一处
//   2. 组件只负责渲染，请求逻辑放进 composable 才好单独测
import { ref } from 'vue'
import { SCORE_SYSTEM, buildScoreUser } from '@/prompts/score'
import { safeParseJSON } from '@/utils/safeParseJSON'
import type { DimensionScore, ScoreResult } from '@/types'

/**
 * 把任意值收敛成 0-100 的整数。
 *
 * 为什么必须做：模型回的不是代码，是文字。实测会出现 800、-5、"80分"、
 * 甚至完全不给你这个字段。这些值直接进模板就是两种坏事：
 *   - 800 → 进度条 width: 800%，撑破卡片，手机上整页能左右拖
 *   - "80分" → NaN，页面上写 NaN 出去
 * 所以宁可显示 0，也不让脏值往下走。
 */
function clamp100(value: unknown): number {
  const n = Number(value)
  // Number.isFinite 同时挡掉 NaN 和 Infinity。NaN 的特点是它跟谁比较都是 false，
  // 所以不能用 n > 100 这种写法兜住它
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

/** 去重并统一成字符串数组：模型偶尔把同一个词说两遍，标签会重复，v-for 的 key 也会撞 */
function unique(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return [...new Set(list.map(String))]
}

export function useScore() {
  const result = ref<ScoreResult | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function run(resume: string, job: string) {
    // 连点两次会发两个请求，后回来的那个覆盖先回来的，用户看到的分数会莫名跳
    if (loading.value) return

    loading.value = true
    error.value = null
    result.value = null

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SCORE_SYSTEM,
          user: buildScoreUser(resume, job),
          // 非流式：评分要一次拿全。半截 JSON 解析不出来，流式在这里没意义
          stream: false,
          // 让代理补上 response_format: json_object
          json: true,
          // 评分要稳定，温度压低
          temperature: 0.2,
        }),
      })

      if (!res.ok) {
        // 代理把原因写在 body 里，先读出来再判断，否则只剩一个数字没法排查
        const info = await res.json().catch(() => null)
        const reason = String(info?.detail || info?.error || '').slice(0, 60)
        if (res.status === 401) throw new Error('Key 无效，检查 .env 里的 DEEPSEEK_API_KEY')
        if (res.status === 429) throw new Error('请求太频繁，等 10 秒再试')
        throw new Error(`请求失败（${res.status}）${reason}`)
      }

      // 代理的非流式分支是把上游原始响应原样透传的，
      // 结构是 { choices: [{ message: { content: "..." } }] }，
      // 分数在那个 content 字符串里，不在顶层
      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content ?? ''

      const obj = safeParseJSON<ScoreResult>(content)
      if (!obj) throw new Error('模型返回的不是合法 JSON')

      // 总分要钳，每个维度分也要钳 —— 只钳总分是这里最容易犯的错
      const dimensions: DimensionScore[] = Array.isArray(obj.dimensions)
        ? obj.dimensions.map((d) => ({
            name: String(d?.name ?? '未命名维度'),
            score: clamp100(d?.score),
            comment: String(d?.comment ?? ''),
          }))
        : []

      result.value = {
        score: clamp100(obj.score),
        dimensions,
        summary: String(obj.summary ?? ''),
        // 不是数组就当空数组：模板里要做 .length 和 map，undefined 会当场炸
        matched: unique(obj.matched),
        missing: unique(obj.missing),
      }
    } catch (e: any) {
      error.value = e?.message ?? '评分失败'
    } finally {
      // 无论成败都要关 loading，否则按钮永远卡在「评分中」，只能刷新
      loading.value = false
    }
  }

  return { result, loading, error, run }
}
