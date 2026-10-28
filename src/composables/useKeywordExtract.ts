import type { KeywordDiff } from '@/types'

/**
 * 前端技能词典（按需增删，保持「领域明确、可枚举」）
 * 注意：不要塞 JS/TS 这种两字母缩写，会误命中大量普通单词
 */
export const SKILLS: string[] = [
  'TypeScript', 'JavaScript', 'Pinia', 'Vuex', 'Webpack', 'Vite', 'Rollup',
  'Vue3', 'Vue2', 'Vue', 'React', 'Node.js', 'ECharts', 'Sass', 'Less',
  'Git', 'HTTP', 'HTML', 'CSS', '小程序', '性能优化', '工程化', '组件库',
  '单元测试', '微前端', 'VueRouter', 'ElementPlus',
]

/**
 * 同义词归并：把「同家族」的词视作等价
 * 例：JD 要求 Vue，简历写 Vue3 → 判定为命中（前端实习场景下这样更合理）
 * 如果想严格区分版本，把下面这张表清空即可
 */
const ALIAS: Record<string, string> = {
  vue: 'vue',
  vue2: 'vue',
  vue3: 'vue',
  vuetouter: 'vuerouter',
  vuerouter: 'vuerouter',
  node: 'node',
  'node.js': 'node',
  nodejs: 'node',
  elementplus: 'elementplus',
}

/**
 * 规范化：小写 + 把「Vue 3」这种字母与数字之间的空格吃掉
 *
 * ⚠️ 这里有个坑：一开始我图省事写的是「删掉所有空白」，
 * 结果 "Vue3 Vue3" 会变成 "vue3vue3"，两个词粘在一起，
 * 后一个 vue3 前面紧跟字母 v，词边界校验把它拦住，一个都命中不了。
 * 所以只能定向删除「字母 → 数字」之间的空格，其余空白保留（它本身就是天然的词边界）。
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/([a-z])\s+(\d)/g, '$1$2') // "vue 3" → "vue3"，不动其它空格
    .replace(/\s+/g, ' ') // 换行、制表符统一成一个空格
}

/** 是否字母/数字（用于词边界判断，避免 Git 命中 Digital） */
function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[a-zA-Z0-9]/.test(ch)
}

/** 取规范名，用于跨写法比较 */
export function canonical(word: string): string {
  const n = normalize(word)
  return ALIAS[n] ?? n
}

/**
 * 从一段文本里抽取命中的技能词
 *
 * 三个必须处理的坑（面试会问）：
 * 1. 长短词遮挡：JavaScript 包含 Java、Vue3 包含 Vue → 按词长倒序 + 标记已占用区间
 * 2. 大小写与空格：VUE 3 / vue3 → 统一 normalize
 * 3. 词边界：Git 不应在 Digital 里命中 → 校验前后字符
 */
export function extractKeywords(text: string): string[] {
  if (!text) return []

  const haystack = normalize(text)
  const used: boolean[] = new Array(haystack.length).fill(false)
  const hits = new Set<string>()

  // 长词优先，保证 JavaScript 先于 Java 占据区间
  const dict = [...SKILLS].sort((a, b) => normalize(b).length - normalize(a).length)

  for (const word of dict) {
    const needle = normalize(word)
    if (!needle) continue

    let from = 0
    while (true) {
      const idx = haystack.indexOf(needle, from)
      if (idx === -1) break

      const end = idx + needle.length

      // ① 区间是否已被更长的词占用
      let free = true
      for (let i = idx; i < end; i++) {
        if (used[i]) {
          free = false
          break
        }
      }

      // ② 词边界：左右不能紧跟字母或数字
      const boundaryOk = !isWordChar(haystack[idx - 1]) && !isWordChar(haystack[end])

      if (free && boundaryOk) {
        hits.add(word)
        for (let i = idx; i < end; i++) used[i] = true
      }

      from = end
    }
  }

  return [...hits]
}

/**
 * 对比简历与 JD 的技能词差异
 * 纯本地计算，不消耗 AI token，耗时通常 < 5ms
 */
export function diffKeywords(resumeText: string, jobText: string): KeywordDiff {
  const resumeHits = new Set(extractKeywords(resumeText).map(canonical))
  const jobWords = extractKeywords(jobText)

  const matched: string[] = []
  const missing: string[] = []

  for (const word of jobWords) {
    if (resumeHits.has(canonical(word))) matched.push(word)
    else missing.push(word)
  }

  const jobCanon = new Set(jobWords.map(canonical))
  const extra = extractKeywords(resumeText).filter((w) => !jobCanon.has(canonical(w)))

  return { matched, missing, extra }
}
