import { describe, expect, it } from 'vitest'
import { diffKeywords, extractKeywords } from './useKeywordExtract'

/**
 * 这 10 条用例就是 W1D4 的验收标准。
 * 跑法：npm test
 */
describe('extractKeywords', () => {
  it('1. JavaScript 命中，但不能被 Java 误判', () => {
    expect(extractKeywords('熟悉 JavaScript')).toEqual(['JavaScript'])
  })

  it('2. Vue3 和 Vue2 同时命中', () => {
    const r = extractKeywords('vue3 和 Vue2 都用过')
    expect(r).toContain('Vue3')
    expect(r).toContain('Vue2')
  })

  it('3. "VUE 3"（带空格、大写）也要命中 Vue3', () => {
    expect(extractKeywords('熟练 VUE 3 开发')).toEqual(['Vue3'])
  })

  it('4. Git 不能在 Digital 里命中（词边界）', () => {
    expect(extractKeywords('Digital marketing experience')).toEqual([])
  })

  it('5. 中文包裹的 Git 能命中', () => {
    expect(extractKeywords('Git 版本管理')).toEqual(['Git'])
  })

  it('6. 多个技能同时命中', () => {
    const r = extractKeywords('TypeScript + Pinia + Vite')
    expect(r.sort()).toEqual(['Pinia', 'TypeScript', 'Vite'])
  })

  it('7. 重复出现只算一次', () => {
    expect(extractKeywords('Vue3 Vue3 Vue3')).toEqual(['Vue3'])
  })

  it('8. 空字符串返回空数组且不报错', () => {
    expect(extractKeywords('')).toEqual([])
  })

  it('9. 纯中文无技能词返回空数组', () => {
    expect(extractKeywords('我是一个热爱学习的学生')).toEqual([])
  })

  it('10. 一万字输入在 100ms 内完成', () => {
    const long = '熟悉 Vue3 和 TypeScript，做过性能优化。'.repeat(400)
    const start = performance.now()
    extractKeywords(long)
    expect(performance.now() - start).toBeLessThan(100)
  })
})

describe('diffKeywords', () => {
  it('JD 要 Vue，简历写 Vue3 视为命中', () => {
    const r = diffKeywords('熟练使用 Vue3 开发后台系统', '要求熟悉 Vue 和 Webpack')
    expect(r.matched).toContain('Vue')
    expect(r.missing).toContain('Webpack')
  })

  it('简历有但 JD 没要求的关键词进 extra', () => {
    const r = diffKeywords('熟练 Vue3、ECharts', '要求熟悉 Vue')
    expect(r.extra).toContain('ECharts')
  })
})
