import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAnalysisStore } from '@/stores/analysis'
import type { ScoreResult } from '@/types'

const memory = new Map<string, string>()

// 临时假实现：node 环境没有 sessionStorage，但被测代码只用这四个方法
const fakeStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
}

const RESULT: ScoreResult = {
  score: 72,
  summary: '技术栈基本对得上',
  matched: ['Vue3'],
  missing: ['Node.js'],
  dimensions: [{ name: '技术栈匹配', score: 80, comment: '' }],
}

describe('analysis store', () => {
  beforeEach(() => {
    memory.clear()
    ;(globalThis as any).sessionStorage = fakeStorage
    setActivePinia(createPinia())
  })

  it('存完能用返回的 id 取回来', () => {
    const store = useAnalysisStore()
    const id = store.saveScore(RESULT, '字节跳动', '前端开发实习生')

    expect(id).toBeTypeOf('string')
    expect(id.length).toBeGreaterThan(6)

    const another = useAnalysisStore()
    expect(another.restore(id)).toBe(true)
    expect(another.current?.result.score).toBe(72)
    expect(another.current?.company).toBe('字节跳动')
  })

  it('id 不存在时返回 false，并把 current 清空', () => {
    const store = useAnalysisStore()
    store.saveScore(RESULT, '字节跳动', '前端开发实习生')
    expect(store.current).not.toBeNull()

    expect(store.restore('abc')).toBe(false)
    expect(store.current).toBeNull()
  })

  it('存储里是坏 JSON 时不抛错，按没有数据处理', () => {
    const store = useAnalysisStore()
    memory.set('offer-lens:analysis', '{半截')

    expect(() => store.restore('anything')).not.toThrow()
    expect(store.restore('anything')).toBe(false)
  })

  it('只保留最近 5 条', () => {
    const store = useAnalysisStore()
    for (let i = 0; i < 7; i++) store.saveScore({ ...RESULT, score: i }, 'c', 'p')

    const saved = JSON.parse(memory.get('offer-lens:analysis') as string)
    expect(saved.length).toBe(5)
  })
})
