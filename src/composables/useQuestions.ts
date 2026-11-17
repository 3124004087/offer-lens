// src/composables/useQuestions.ts
// 面试题预测的请求逻辑。第三条 AI 支线，跟前两条的分工：
//   评分 useScore     —— 非流式，数据小（约 100 token），3 秒出
//   改写 useRewrite   —— 流式，数据大（约 900 token），15 秒，边到边看
//   出题 useQuestions —— 非流式，数据中等（约 700 token），6 秒左右
//
// 出题为什么不流式：一道题必须「问句 + 思路 + 难度」齐全才有用。
// 只到一半的题既看不了也自评不了，不如等 6 秒一次拿全。
// 判断依据始终是「数据能不能分开用」，不是「流式更高级」。
import { computed, ref } from 'vue'
import { QUESTION_SYSTEM, buildQuestionUser } from '@/prompts/question'
import { safeParseJSON } from '@/utils/safeParseJSON'
import type { Question } from '@/types'

/** 模型只允许吐这三个值。它经常自创 "framework"、"基础" 这类分类 */
const CATEGORIES: Question['category'][] = ['basic', 'project', 'scene']

/** 页面上按 3 / 3 / 2 排版，模型多给也没地方放 */
const MAX_COUNT = 8

/**
 * 把难度收敛成 1-3 的整数。
 *
 * 为什么必须兜：模型会给 "中等"、5、0，甚至不给。
 * 这些值直接进模板有两种坏事：
 *   - "中等" → NaN，三个难度点一个都不亮，用户以为题坏了
 *   - 5 → 渲染五个点，把卡片撑歪
 * 所以宁可显示 1（最容易），也不让脏值往下走。思路和 useScore 里的 clamp100 一致。
 */
function clampDifficulty(value: unknown): 1 | 2 | 3 {
  const n = Math.round(Number(value))
  // Number.isFinite 同时挡掉 NaN 和 Infinity。
  // 注意 NaN 的特点是「跟谁比都是 false」，所以不能用 n < 1 这种写法兜住它
  if (!Number.isFinite(n)) return 1
  if (n < 1) return 1
  if (n > 3) return 3
  // 走到这里 n 一定是 1/2/3，但 TypeScript 只认 number，
  // 用 as 告诉它「我保证在这个范围内」——这是本项目里唯一允许的类型断言
  return n as 1 | 2 | 3
}

/**
 * 模型返回的 items 数组 → 前端能安全渲染的 Question[]。
 *
 * 单独抽成导出函数，是为了能手写用例测（不用起 fetch、不用花 token）。
 * 三处兜底各挡一类真实故障，见下面注释。
 */
export function normalizeQuestions(raw: unknown): Question[] {
  // 模型有时把 items 写成字符串、有时干脆给个对象，不是数组就当没有
  if (!Array.isArray(raw)) return []

  const list: Question[] = []

  for (let i = 0; i < raw.length; i++) {
    // 够 8 道就停：先判断条数再判断内容，
    // 否则前几条脏数据会白占名额（脏值不能被算进「已经收够」）
    if (list.length >= MAX_COUNT) break

    const obj = raw[i]
    // null、字符串、数字都进不来
    if (!obj || typeof obj !== 'object') continue

    const item = obj as Record<string, unknown>
    const question = String(item.question ?? '').trim()
    // 没有题干的题渲染出来就是一张空卡，直接丢
    if (!question) continue

    // 白名单兜底。不兜的后果很具体：三个 Tab 只认这三个 key，
    // 分类是 "framework" 的那道题会掉出所有 Tab —— 页头写「共 8 道」，
    // 用户数来数去只有 7 道，还找不到少的那个去哪了
    const c = String(item.category ?? '').trim() as Question['category']
    const category = CATEGORIES.includes(c) ? c : 'basic'

    list.push({
      // id 由前端补，模型只负责内容（同 useRewrite 的理由）。
      // 用「下标 + 分类」：出题是一次性拿全的，不像改写会不断追加，
      // 下标天然稳定；拼上分类是为了浏览器调试时一眼看出这是哪类题
      id: `${i}-${category}`,
      category,
      question,
      hint: String(item.hint ?? ''),
      difficulty: clampDifficulty(item.difficulty),
      // mastered 是「你的状态」，不是「模型的判断」。
      // 让模型返回它，等于让 AI 替你决定复习进度 —— 而且下次重新生成会被覆盖
      mastered: false,
    })
  }

  return list
}

export function useQuestions() {
  const list = ref<Question[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** 顶部「已掌握 x / 8」用它，别在模板里写 filter().length（每次渲染都重算） */
  const masteredCount = computed(() => list.value.filter((q) => q.mastered).length)

  async function run(resume: string, job: string, missing: string[]) {
    // 连点两次会发两个请求，后回来的覆盖先回来的，题目会莫名换一套
    if (loading.value) return

    loading.value = true
    error.value = null
    list.value = []

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: QUESTION_SYSTEM,
          user: buildQuestionUser(resume, job, missing),
          // 非流式：要一次拿全 8 道
          stream: false,
          // 让代理补上 response_format: json_object
          json: true,
          // 出题温度比评分（0.2）高一点：太死板会 8 道题都问同一类，
          // 但也不能高，否则同样简历生成两次题目完全不同，显得随机
          temperature: 0.4,
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

      // 和评分一样：代理的非流式分支把上游原始响应透传，
      // 内容是 { choices: [{ message: { content: "..." } }] }，
      // 题目在那个 content 字符串里，不在顶层
      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content ?? ''

      const obj = safeParseJSON<{ items?: unknown }>(content)
      if (!obj) throw new Error('模型返回的不是合法 JSON')

      const items = normalizeQuestions(obj.items)
      // 兜底完一条不剩，说明这次真的失败了。
      // 不抛的话页面会显示「0 道题」的空列表，用户以为功能坏了却没提示
      if (items.length === 0) throw new Error('这次没生成出题目，再点一次试试')

      list.value = items
    } catch (e: any) {
      error.value = e?.message ?? '生成失败'
    } finally {
      // 无论成败都要关 loading，否则按钮永远卡在「生成中」，只能刷新
      loading.value = false
    }
  }

  /**
   * 自评：会 ↔ 不会。
   *
   * 直接改数组里那个对象的属性，不整份换引用 —— ref 里存的是响应式代理，
   * 改属性照样触发更新，比 list.value = list.value.map(...) 省一次全量渲染。
   * 更关键的是：状态挂在父级数组上，子组件切 Tab 被卸载也不影响它（今天的八股）。
   */
  function toggleMastered(id: string) {
    const hit = list.value.find((q) => q.id === id)
    if (!hit) return
    hit.mastered = !hit.mastered
  }

  /** 换一份简历重新出题时清空，避免旧题混在新题里 */
  function reset() {
    list.value = []
    error.value = null
  }

  return { list, loading, error, masteredCount, run, toggleMastered, reset }
}
