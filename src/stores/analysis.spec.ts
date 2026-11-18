// stores/analysis.spec.ts
// 这一版从「假 sessionStorage」换成了 fake-indexeddb：
// 被测代码现在真的走 IndexedDB 那套异步流程，用假对象糊过去就测不到关键点
// （事务什么时候 complete、索引排序对不对）。
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAnalysisStore } from '@/stores/analysis'
import { clearAnalyses, getAnalysis, putAnalysis } from '@/composables/useLocalDB'
import type { SavedAnalysis, ScoreResult } from '@/types'

const RESULT: ScoreResult = {
  score: 72,
  summary: '技术栈基本对得上',
  matched: ['Vue3'],
  missing: ['Node.js'],
  dimensions: [{ name: '技术栈匹配', score: 80, comment: '' }],
}

const INPUT = {
  company: '字节跳动',
  position: '前端开发实习生',
  resumeText: '简历原文',
  jobText: 'JD 原文',
}

/** 造一条记录，只覆盖关心的字段 */
function makeRecord(over: Partial<SavedAnalysis> = {}): SavedAnalysis {
  return {
    id: 'rec-1',
    ...INPUT,
    result: RESULT,
    rewrites: [],
    questions: [],
    applied: false,
    createdAt: 1000,
    ...over,
  }
}

describe('analysis store', () => {
  beforeEach(async () => {
    // 每个用例从空库开始：fake-indexeddb 的库是模块级的，不清会串数据
    await clearAnalyses()
    setActivePinia(createPinia())
  })

  it('存完能用返回的 id 取回来，原文字段也跟着存了', async () => {
    const store = useAnalysisStore()
    const id = await store.saveScore(RESULT, INPUT)

    expect(id).toBeTypeOf('string')
    expect(id.length).toBeGreaterThan(6)

    // 换一个 pinia 实例 = 模拟刷新页面：内存里的 store 全没了，只剩库里的
    setActivePinia(createPinia())
    const another = useAnalysisStore()
    expect(another.current).toBeNull()

    expect(await another.restore(id)).toBe(true)
    expect(another.current?.result.score).toBe(72)
    expect(another.current?.company).toBe('字节跳动')
    // 原文快照是这次新增的：有了它，刷新后还能改写 / 出题
    expect(another.current?.resumeText).toBe('简历原文')
  })

  it('id 不存在时返回 false，并把 current 清空', async () => {
    const store = useAnalysisStore()
    await store.saveScore(RESULT, INPUT)
    expect(store.current).not.toBeNull()

    expect(await store.restore('abc')).toBe(false)
    expect(store.current).toBeNull()
  })

  it('连存两次 id 不相同，不会互相覆盖', async () => {
    const store = useAnalysisStore()
    const a = await store.saveScore(RESULT, INPUT)
    const b = await store.saveScore(RESULT, INPUT)

    expect(a).not.toBe(b)
    expect(await store.list()).toHaveLength(2)
  })

  it('列表按创建时间倒序，新的在最前面', async () => {
    // 直接写库而不是调 saveScore：saveScore 用 Date.now()，连存三条大概率同一毫秒，
    // 排序就测不出东西了
    await putAnalysis(makeRecord({ id: 'old', createdAt: 1000 }))
    await putAnalysis(makeRecord({ id: 'new', createdAt: 3000 }))
    await putAnalysis(makeRecord({ id: 'mid', createdAt: 2000 }))

    const list = await useAnalysisStore().list()
    expect(list.map((x) => x.id)).toEqual(['new', 'mid', 'old'])
  })

  it('patch 只改传进去的字段，其他字段原样保留', async () => {
    const store = useAnalysisStore()
    const id = await store.saveScore(RESULT, INPUT)

    const next = await store.patch(id, {
      questions: [{ id: '0-basic', category: 'basic', question: 'q', hint: '', difficulty: 1, mastered: true }],
      applied: true,
    })

    expect(next?.questions).toHaveLength(1)
    expect(next?.applied).toBe(true)
    // 没传的字段不能被抹掉
    expect(next?.company).toBe('字节跳动')
    expect(next?.result.score).toBe(72)
    // 内存里的那一份也要同步，否则回结果页看到的是旧数据
    expect(store.current?.applied).toBe(true)

    // 再从库里读一次，确认真落盘了
    const raw = await getAnalysis(id)
    expect(raw?.questions).toHaveLength(1)
  })

  it('记录不在了，patch 返回 null 而不是抛错', async () => {
    const store = useAnalysisStore()
    expect(await store.patch('nope', { applied: true })).toBeNull()
  })

  it('clearAll 之后列表为空，current 也清掉', async () => {
    const store = useAnalysisStore()
    await store.saveScore(RESULT, INPUT)

    expect(await store.clearAll()).toBe(true)
    expect(store.current).toBeNull()
    expect(await store.list()).toEqual([])
  })
})
