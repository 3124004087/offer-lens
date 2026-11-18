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

/** 评分这一次请求的返回，字段都是从 Analysis 里挑的，不另造一套 */
export type ScoreResult = Pick<Analysis, 'score' | 'dimensions' | 'summary' | 'matched' | 'missing'>

/**
 * 落进 IndexedDB 的一条分析记录。
 *
 * 为什么把简历 / JD 原文也存进来：分析是分几天做完的（先评分、再改写、再出题），
 * 刷新或第二天打开时 store 里的草稿可能早换成了别的简历。
 * 每条记录自带原文快照，就不用去猜「这条记录当时用的是哪份输入」。
 */
export interface SavedAnalysis {
  id: string
  company: string
  position: string
  resumeText: string
  jobText: string
  result: ScoreResult
  rewrites: RewriteItem[]
  questions: Question[]
  /** 是否已投递这个岗位，历史列表里手动标记 */
  applied: boolean
  createdAt: number
}
