// stores/analysis.ts
// 为什么要有这个 store：
// 分析结果要显示在 /result/:id 这个**另一个路由**上，而组件一换掉，
// useScore 里的 result（一个普通 ref）就跟着组件一起销毁了。
// 所以结果必须放到组件外面还活着的地方 —— 一层是 Pinia，另一层是 IndexedDB。
//
// 两层各管一件事（这条是 W3D3 的核心）：
//   内存里的 current —— 当前这一页要渲染的东西，随取随用，不等异步
//   IndexedDB 里的记录 —— 关掉标签页、换一天再打开还在，历史页读的是它
// 写的时候两边都要写；读的时候先看内存（快），内存没有再去库里捞（准）。
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { SavedAnalysis, ScoreResult } from '@/types'
import {
  clearAnalyses,
  getAnalysis,
  listAnalyses,
  patchAnalysis,
  putAnalysis,
  removeAnalysis,
} from '@/composables/useLocalDB'

/** 存一次结果时要一起带上来的输入快照 */
export interface SaveInput {
  company: string
  position: string
  resumeText: string
  jobText: string
}

/**
 * 生成 id。
 * 不用 Date.now() 单独当 id：同一毫秒内点两次会撞，撞了就会互相覆盖。
 * toString(36) 是把数字转成 36 进制，字符串更短（时间戳会变成 8 位左右）。
 */
function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export const useAnalysisStore = defineStore('analysis', () => {
  /** 当前这次分析。模板里直接 analysis.current.result.score 这样用 */
  const current = ref<SavedAnalysis | null>(null)

  /**
   * 存一次结果，返回生成的 id。
   * 调用方拿到 id 就能 router.push(`/result/${id}`)。
   *
   * 为什么是 async：IndexedDB 全是异步的，写盘要等事务结束。
   * 但写失败不该把当前这次结果一起毁掉 —— 内存里还有 current，
   * 这一页照样能看，只是历史里少一条。所以 catch 住，不往上抛。
   */
  async function saveScore(result: ScoreResult, input: SaveInput): Promise<string> {
    const item: SavedAnalysis = {
      id: makeId(),
      company: input.company,
      position: input.position,
      resumeText: input.resumeText,
      jobText: input.jobText,
      result,
      // 改写和面试题是后面几步才生成的，先占位；生成完用 patch 补进去
      rewrites: [],
      questions: [],
      applied: false,
      createdAt: Date.now(),
    }

    try {
      await putAnalysis(item)
    } catch (e) {
      console.warn('[analysis] 本地保存失败，本次结果只在内存里', e)
    }

    current.value = item
    return item.id
  }

  /**
   * 按 id 找回结果，找不到返回 false。
   * 结果页刷新、从历史列表点进来，都靠它。
   *
   * 返回布尔值而不是抛错：找不到是正常情况（记录被清了、链接是别人转发的），
   * 页面应该显示空态，而不是报错白屏。
   */
  async function restore(id: string): Promise<boolean> {
    // 内存里已经是这一条（刚从工作台跳过来、或结果页 ↔ 题目页来回切），
    // 就不必再读一次库：省一次异步，也避免「写库失败但这次结果明明在内存里」
    // 被误判成「记录不在了」
    if (current.value?.id === id) return true

    try {
      const hit = await getAnalysis(id)
      current.value = hit ?? null
      return hit !== undefined
    } catch (e) {
      console.warn('[analysis] 读取本地记录失败', e)
      current.value = null
      return false
    }
  }

  /**
   * 局部更新当前记录（补改写、补题目、改自评、标已投递）。
   * 返回合并后的记录；原记录不在了返回 null。
   */
  async function patch(id: string, changes: Partial<SavedAnalysis>): Promise<SavedAnalysis | null> {
    try {
      const next = await patchAnalysis(id, changes)
      // 同步内存那份：否则用户先看结果页、再回题目页时，读到的是旧数据
      if (next && current.value?.id === id) current.value = next
      return next
    } catch (e) {
      console.warn('[analysis] 本地更新失败', e)
      return null
    }
  }

  /** 历史列表。失败要往上抛：历史页需要区分「真没有记录」和「读不出来」 */
  function list(): Promise<SavedAnalysis[]> {
    return listAnalyses()
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await removeAnalysis(id)
      if (current.value?.id === id) current.value = null
      return true
    } catch (e) {
      console.warn('[analysis] 删除失败', e)
      return false
    }
  }

  async function clearAll(): Promise<boolean> {
    try {
      await clearAnalyses()
      current.value = null
      return true
    } catch (e) {
      console.warn('[analysis] 清空失败', e)
      return false
    }
  }

  return { current, saveScore, restore, patch, list, remove, clearAll }
})
