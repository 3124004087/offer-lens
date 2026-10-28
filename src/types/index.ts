/** 简历 */
export interface Resume {
  id: string
  rawText: string
  wordCount: number
  createdAt: number
}

/** 岗位描述 */
export interface Job {
  id: string
  company: string
  position: string
  rawText: string
  keywords: string[]
  createdAt: number
}

/** 分维度得分 */
export interface DimensionScore {
  name: string
  score: number
  comment: string
}

/** 一段改写建议 */
export interface RewriteItem {
  id: string
  origin: string
  suggestion: string
  reason: string
  type: 'weak' | 'missing' | 'good'
}

/** 一道面试题 */
export interface Question {
  id: string
  category: 'basic' | 'project' | 'scene'
  question: string
  hint: string
  difficulty: 1 | 2 | 3
  mastered: boolean
}

/** 一次完整分析 */
export interface Analysis {
  id: string
  resumeId: string
  jobId: string
  score: number
  dimensions: DimensionScore[]
  summary: string
  matched: string[]
  missing: string[]
  rewrites: RewriteItem[]
  questions: Question[]
  status: 'draft' | 'done'
  applied: boolean
  createdAt: number
}

/** 关键词差异结果（本地计算，不消耗 AI） */
export interface KeywordDiff {
  matched: string[]
  missing: string[]
  extra: string[]   // 简历里有、但 JD 没要求的
}
