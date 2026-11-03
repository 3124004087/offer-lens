import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { diffKeywords } from '@/composables/useKeywordExtract'

const DRAFT_KEY = 'offer-lens:draft'
const DRAFT_DELAY = 2000

interface Draft {
  resumeText: string
  jobText: string
  company: string
  position: string
}

const EMPTY: Draft = { resumeText: '', jobText: '', company: '', position: '' }

/** 读取草稿：任何异常都返回空值，绝不让脏数据把页面搞崩 */
function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return { ...EMPTY }
    const data = JSON.parse(raw) as Partial<Draft>
    return {
      resumeText: typeof data.resumeText === 'string' ? data.resumeText : '',
      jobText: typeof data.jobText === 'string' ? data.jobText : '',
      company: typeof data.company === 'string' ? data.company : '',
      position: typeof data.position === 'string' ? data.position : '',
    }
  } catch {
    return { ...EMPTY }
  }
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const saved = readDraft()

  const resumeText = ref(saved.resumeText)
  const jobText = ref(saved.jobText)
  const company = ref(saved.company)
  const position = ref(saved.position)

  /** 本地关键词差异：computed 自动缓存，输入不变就不重算 */
  const keywordDiff = computed(() => diffKeywords(resumeText.value, jobText.value))

  const canAnalyze = computed(
    () => resumeText.value.trim().length >= 100 && jobText.value.trim().length >= 100,
  )

  const disabledReason = computed(() => {
    if (resumeText.value.trim().length < 100) return '简历内容太少（至少 100 字）'
    if (jobText.value.trim().length < 100) return 'JD 内容太少（至少 100 字）'
    return ''
  })

  /**
   * 真正落盘。所有落盘路径都走这里 —— 以后加字段只改这一处。
   * 否则「防抖写」和「关页面前写」各存一份序列化逻辑，加字段必漏一个。
   */
  function writeDraft() {
    console.log('写盘', performance.now().toFixed(0))
    const draft: Draft = {
      resumeText: resumeText.value,
      jobText: jobText.value,
      company: company.value,
      position: position.value,
    }
    // 全空就不存：省一次同步写，也顺手绕开 reset() 之后
    // watch 又触发、2 秒后把空草稿写回去的问题
    if (!draft.resumeText && !draft.jobText && !draft.company && !draft.position) {
      localStorage.removeItem(DRAFT_KEY)
      return
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }

  let timer: ReturnType<typeof setTimeout> | null = null

  /**
   * 立即落盘。必须先 clearTimeout 再写：
   * 用户刚打完字就切走标签页时，那个 2 秒的定时器还挂着；
   * 不清的话这次写完它还会再写一次（多一次同步阻塞 + timer 指向失效 id）。
   */
  function flushDraft() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    writeDraft()
  }

  /** 防抖写草稿：连续输入时只在停下来 2 秒后写一次 localStorage */
  watch([resumeText, jobText, company, position], () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      writeDraft()
    }, DRAFT_DELAY)
  })

  // store 里没有组件实例，onUnmounted 拿不到；
  // setup store 跑在自己的 effectScope 里，只有 onScopeDispose 能跟着销毁
  onScopeDispose(() => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  })

  function reset() {
    resumeText.value = ''
    jobText.value = ''
    company.value = ''
    position.value = ''
    // 不等那 2 秒：立刻落一次，此时四个字段都空，writeDraft 会直接 removeItem
    flushDraft()
  }

  return {
    resumeText,
    jobText,
    company,
    position,
    keywordDiff,
    canAnalyze,
    disabledReason,
    flushDraft,
    reset,
  }
})
