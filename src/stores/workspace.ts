import { computed, ref, watch } from 'vue'
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

  /** 防抖写草稿：连续输入时只在停下来 2 秒后写一次 localStorage */
  let timer: ReturnType<typeof setTimeout> | null = null

  watch([resumeText, jobText, company, position], () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          resumeText: resumeText.value,
          jobText: jobText.value,
          company: company.value,
          position: position.value,
        }),
      )
      timer = null
    }, DRAFT_DELAY)
  })

  function reset() {
    resumeText.value = ''
    jobText.value = ''
    company.value = ''
    position.value = ''
    localStorage.removeItem(DRAFT_KEY)
  }

  return {
    resumeText,
    jobText,
    company,
    position,
    keywordDiff,
    canAnalyze,
    disabledReason,
    reset,
  }
})
