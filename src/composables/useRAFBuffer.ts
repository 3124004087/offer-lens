// composables/useRAFBuffer.ts
import { onScopeDispose } from 'vue'

/**
 * 把「一帧内的多次触发」压成一次执行。
 *
 * 传进来一个「重算 + 重画」的函数，schedule() 随便调多少次，
 * 一个屏幕刷新周期（60Hz 就是约 16 毫秒）内只会真跑一次。
 *
 * 为什么用它：AI 流式每秒来几十片文字，每来一片就重算一次、换一次数组引用，
 * 等于同一个 16 毫秒里算了好几遍，浏览器只会把最后一遍画出来 —— 前面几遍是白算的。
 *
 * 实测说明（2026-11-24）：本项目在本地实测基线长任务为 0（主线程本来就没被卡住），
 * 所以这个改动测不出肉眼可见的差异。它属于「兜底」而不是「提速」：
 * 等 token 更快、或一次返回条目更多时，合并才真正开始省。
 */
export function useRAFBuffer(flush: () => void) {
  let rafId = 0

  function schedule() {
    if (rafId) return // 这一帧已经排上了，再调也没用
    rafId = requestAnimationFrame(() => {
      // 先清零再执行：如果 flush 内部又调了 schedule()，
      // 此时 rafId 已是 0，能正常排下一帧；反过来写就会把这次调用吞掉
      rafId = 0
      flush()
    })
  }

  function cancel() {
    if (!rafId) return
    cancelAnimationFrame(rafId)
    rafId = 0
  }

  // 组件/页面卸载后别再往回画，否则会往已销毁的实例上写值
  onScopeDispose(cancel)

  return { schedule, cancel }
}
