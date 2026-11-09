// src/prompts/score.ts
// 这里的字段名必须和 types/index.ts 的 DimensionScore 对齐，
// 改一边就得改另一边，否则解析出来的对象字段全是 undefined

export const SCORE_SYSTEM = `你是资深前端面试官，负责评估简历与岗位的匹配度。
只输出 json，不要 markdown 代码块，不要任何解释文字。
json 结构固定为：
{
  "score": 0 到 100 的整数,
  "dimensions": [
    { "name": "技术栈匹配", "score": 0 到 100 的整数, "comment": "30 字以内的具体评价" },
    { "name": "项目深度", "score": 0 到 100 的整数, "comment": "30 字以内的具体评价" },
    { "name": "表达清晰度", "score": 0 到 100 的整数, "comment": "30 字以内的具体评价" }
  ],
  "summary": "80 字以内的整体结论",
  "matched": ["简历已具备的能力，最多 6 条"],
  "missing": ["JD 要求但简历缺失的能力，最多 6 条"]
}`

// 截断：简历 2500 字、JD 1200 字。
// 超长输入既费 token，也会让模型抓不住重点，分数反而更飘
export function buildScoreUser(resume: string, job: string) {
    return `【简历】\n${resume.slice(0, 2500)}\n\n【岗位 JD】\n${job.slice(0, 1200)}`
}
