import { describe, expect, it } from 'vitest'
import { diffKeywords } from '@/composables/useKeywordExtract'
import { SAMPLE_JOB, SAMPLE_RESUME } from './samples'

/**
 * 把示例数据的预期结果也锁进测试。
 * 以后改词典或改示例文本时，跑一下就知道有没有跑偏。
 */
describe('示例数据的关键词差异', () => {
  const diff = diffKeywords(SAMPLE_RESUME, SAMPLE_JOB)

  it('命中 9 项', () => {
    expect(diff.matched.sort()).toEqual(
      ['CSS', 'Git', 'HTML', 'JavaScript', 'Pinia', 'TypeScript', 'Vite', 'Vue3', '性能优化'].sort(),
    )
  })

  it('缺失 5 项', () => {
    expect(diff.missing.sort()).toEqual(['Webpack', '单元测试', '小程序', '工程化', '组件库'].sort())
  })

  it('简历多出 ECharts', () => {
    expect(diff.extra).toContain('ECharts')
  })

  it('覆盖率 64%', () => {
    const total = diff.matched.length + diff.missing.length
    expect(Math.round((diff.matched.length / total) * 100)).toBe(64)
  })
})
