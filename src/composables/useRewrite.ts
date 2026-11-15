// composables/useRewrite.ts
// 改写建议的请求逻辑。和 useScore 的分工：
//   评分  —— 数据小（约 100 token）、要一次拿全 → 非流式 + JSON.parse 一次
//   改写  —— 数据大（约 900 token）、生成 15 秒 → 流式 + extractObjects 边到边收
// 这不是「谁更高级」，是按数据量级选的。面试被问「为什么这快流式那块不流式」就这么答。
import { ref } from 'vue'
import { useAIStream } from './useAIStream'
import { REWRITE_SYSTEM, buildRewriteUser } from '@/prompts/rewrite'
import { extractObjects } from '@/utils/extractObjects'
import type { RewriteItem } from '@/types'

/** 模型只允许吐这三个值；收别的都归到 weak */
const VALID_TYPES: RewriteItem['type'][] = ['weak', 'missing', 'good']

/**
 * AI 返回的裸对象 → 前端能安全渲染的 RewriteItem。
 * 返回 null 表示「这不是条目」：外壳 {"items":[...]} 在整体收尾时
 * 会被 extractObjects 解析出来，它没有 origin；模型夹带的杂对象同理。
 * 字段过滤放这里而不是 extractObjects——结构归工具，业务归调用方。
 */
function toItem(obj: any, i: number): RewriteItem | null {
  if (typeof obj?.origin !== 'string') return null

  const t = String(obj.type ?? '').trim() as RewriteItem['type']

  return {
    // 模型不返回 id（它只管内容），id 由前端补。
    // 用「下标 + 原句片段」：流式全量重扫只会往后追加，前面的条目
    // 不会再变，所以下标稳定；加原句片段是给以后的按句定位留依据
    id: `${i}-${obj.origin.slice(0, 6)}`,
    origin: obj.origin,
    // 模型偶尔给 "good "（带空格）或 "warning"；
    // 不兜底的话 :class 会拼出 rw rw-warning 这种没人定义的类名
    type: VALID_TYPES.includes(t) ? t : 'weak',
    suggestion: String(obj.suggestion ?? ''),
    reason: String(obj.reason ?? ''),
  }
}

export function useRewrite() {
  const list = ref<RewriteItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const stream = useAIStream()

  /**
   * 入参里的 missing 来自 useKeywordExtract 的本地比对结果，
   * 直接喂给模型当「已知差距」——省 token，输出还更稳。
   */
  async function run(resume: string, job: string, missing: string[]) {
    // useAIStream 内部也有这层判断，但那是它自己的 loading；
    // 按钮置灰看的是这里的，两份状态各挡各的
    if (loading.value) return

    loading.value = true
    error.value = null
    list.value = []

    // 累积已到的原文。放普通变量而不是 ref：
    // 模板不渲染它，不需要响应式（ref 有开销也有坑）
    let buffer = ''

    try {
      await stream.run(
        { system: REWRITE_SYSTEM, user: buildRewriteUser(resume, job, missing), json: true },
        {
          // 核心三步：累加 → 全量重扫 → 换整个数组引用。
          // 看着像 O(n²)（每来一片重扫全部），但总长一两千字，实测无感。
          // 每次换引用会让 Vue 全量重渲染这张列表，也先接受——
          // W4D1 用 rAF 收敛渲染频率。先让它对，再谈快
          onDelta: (chunk) => {
            buffer += chunk
            list.value = extractObjects(buffer)
              .map(toItem)
              .filter((x): x is RewriteItem => x !== null)
          },
          onError: (msg) => {
            error.value = msg
          },
        },
      )
    } finally {
      // 出错时故意不清空 list：已经收到的条目是真的，留着给用户看；
      // 错误信息单独显示，重试时会整体重开（run 开头的 list.value = []）
      loading.value = false
    }
  }

  /** 中途取消：界面上的按钮接这个，取消后已收的条目同样保留 */
  function stop() {
    stream.stop()
  }

  return { list, loading, error, run, stop }
}
