// composables/useLocalDB.spec.ts
// 这一层只测「容易写错、写错了又看不出来」的地方：
// 空库、伪装的 id、删不干净。事务封装本身（utils/idb.ts）由 store 的用例覆盖。
import 'fake-indexeddb/auto'
import { isProxy, reactive } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAnalyses,
  getAnalysis,
  listAnalyses,
  patchAnalysis,
  putAnalysis,
  removeAnalysis,
} from '@/composables/useLocalDB'
import type { SavedAnalysis } from '@/types'

function makeRecord(over: Partial<SavedAnalysis> = {}): SavedAnalysis {
  return {
    id: 'rec-1',
    company: '公司',
    position: '岗位',
    resumeText: 'r',
    jobText: 'j',
    result: { score: 60, summary: '', matched: [], missing: [], dimensions: [] },
    rewrites: [],
    questions: [],
    applied: false,
    createdAt: 1000,
    ...over,
  }
}

describe('useLocalDB', () => {
  beforeEach(async () => {
    await clearAnalyses()
  })

  it('空库返回空数组，不抛错', async () => {
    expect(await listAnalyses()).toEqual([])
    expect(await getAnalysis('nope')).toBeUndefined()
  })

  it('patch 里带了别的 id，也不能把记录搬走', async () => {
    await putAnalysis(makeRecord({ id: 'keep-me' }))

    // 真实场景：调用方把整条记录连 id 一起传进来改，改出个新 id 就会多一条孤儿数据
    const next = await patchAnalysis('keep-me', { applied: true, id: 'hacked' })

    expect(next?.id).toBe('keep-me')
    expect(await getAnalysis('keep-me')).toBeDefined()
    expect(await getAnalysis('hacked')).toBeUndefined()
  })

  it('remove 之后按 id 就取不到了', async () => {
    await putAnalysis(makeRecord({ id: 'x' }))
    await removeAnalysis('x')

    expect(await getAnalysis('x')).toBeUndefined()
    expect(await listAnalyses()).toEqual([])
  })

  it('同 id 再写一次是覆盖，不是新增', async () => {
    await putAnalysis(makeRecord({ id: 'same', company: 'A' }))
    await putAnalysis(makeRecord({ id: 'same', company: 'B' }))

    const list = await listAnalyses()
    expect(list).toHaveLength(1)
    expect(list[0].company).toBe('B')
  })

  it('响应式对象也能存进去（Proxy 直接进库会报 DataCloneError）', async () => {
    // 复现线上那个真 bug：saveScore 里 result 来自 useScore 的 ref，
    // 取出来是 Proxy。不剥成纯数据直接 put，会抛
    // 「DataCloneError: #<Object> could not be cloned」，
    // 表现就是「结果页正常、历史页永远是空的」。
    const item = reactive(makeRecord({ id: 'proxy-1', company: '字节' }))
    await putAnalysis(item as SavedAnalysis)

    const back = await getAnalysis('proxy-1')
    expect(back?.company).toBe('字节')
    // 存进去的必须已经脱离响应式，否则下次 patch 合并时又会带上代理
    expect(isProxy(back)).toBe(false)
    expect(isProxy(back?.result)).toBe(false)
  })
})
