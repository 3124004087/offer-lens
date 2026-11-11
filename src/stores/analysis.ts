// stores/analysis.ts
// 为什么要有这个 store：
// 分析结果要显示在 /result/:id 这个**另一个路由**上，而组件一换掉，
// useScore 里的 result（一个普通 ref）就跟着组件一起销毁了。
// 所以结果必须放到组件外面还活着的地方 —— Pinia store。
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ScoreResult } from '@/types'

const KEY = 'offer-lens:analysis'

/** 一次分析结果，连同「哪份简历配哪个岗位」的快照一起存 */
interface AnalysisItem {
  id: string
  result: ScoreResult
  company: string
  position: string
  createdAt: number
}

/**
 * 生成 id。
 * 不用 Date.now() 单独当 id：同一毫秒内点两次会撞，撞了就会互相覆盖。
 * toString(36) 是把数字转成 36 进制，字符串更短（时间戳会变成 8 位左右）。
 */
function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * 读出全部记录。
 * JSON.parse 遇到坏数据（比如手工改过、写到一半断电）会直接抛错，
 * 不接住的话整页白屏，所以任何异常都当「没有数据」处理。
 */
function readAll(): AnalysisItem[] {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    // 存的不是数组（被别的东西覆盖过）也当没有
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export const useAnalysisStore = defineStore('analysis', () => {
  /** 当前这次分析。模板里直接 analysis.current.result.score 这样用 */
  const current = ref<AnalysisItem | null>(null)

  /**
   * 存一次结果，返回生成的 id。
   * 调用方拿到 id 就能 router.push(`/result/${id}`)。
   */
  function saveScore(result: ScoreResult, company: string, position: string): string {
    const item: AnalysisItem = {
      id: makeId(),
      result,
      company,
      position,
      createdAt: Date.now(),
    }

    // 只留最近 5 条：sessionStorage 也有配额（约 5MB），不清会越堆越多。
    // 新的一条放最前面，方便以后做「上次的结果」。
    const list = [item, ...readAll()].slice(0, 5)

    try {
      sessionStorage.setItem(KEY, JSON.stringify(list))
    } catch {
      // 配额满了写不进去也没关系：内存里的 current 还在，当前页面照样能看
    }

    current.value = item
    return item.id
  }

  /**
   * 按 id 找回结果，找不到返回 false。
   * 结果页刷新后就靠它 —— 返回布尔值而不是直接抛错，
   * 是因为「找不到」是正常情况（别人分享的链接、关掉标签页后再打开），
   * 页面应该显示空态，而不是报错。
   */
  function restore(id: string): boolean {
    const hit = readAll().find((x) => x.id === id) ?? null
    current.value = hit
    return hit !== null
  }

  return { current, saveScore, restore }
})
