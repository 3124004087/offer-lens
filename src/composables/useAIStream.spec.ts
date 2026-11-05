import { describe, expect, it } from 'vitest'
import { consume } from './useAIStream'

/**
 * 造一个「可以任性切断」的 SSE 流。
 * 只在测试里用，所以不放 composable —— 放源码里会被打进产物。
 */
function fakeSSE(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((t) => c.enqueue(typeof t === 'string' ? enc.encode(t) : t))
      c.close()
    },
  })
}

/** 跑完整个流，把所有片段拼起来 */
async function collect(chunks: Array<string | Uint8Array>) {
  const got: string[] = []
  await consume(fakeSSE(chunks), (d) => got.push(d))
  return got.join('')
}

describe('consume', () => {
  it('1. 正常的两个 data 行', async () => {
    const text = await collect([
      'data: {"choices":[{"delta":{"content":"你"}}]}\n',
      'data: {"choices":[{"delta":{"content":"好"}}]}\n',
      'data: [DONE]\n',
    ])
    expect(text).toBe('你好')
  })

  it('2. 半包：JSON 被切断在 choi / ces 之间', async () => {
    const text = await collect([
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\ndata: {"choi',
      'ces":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n',
    ])
    expect(text).toBe('你好')
  })

  it('3. 逐 2 字节喂：汉字也被切开，靠 stream:true 拼回来', async () => {
    const whole = 'data: {"choices":[{"delta":{"content":"中文测试"}}]}\n\ndata: [DONE]\n\n'
    const bytes = new TextEncoder().encode(whole)
    const chunks: Uint8Array[] = []
    for (let i = 0; i < bytes.length; i += 2) chunks.push(bytes.slice(i, i + 2))

    expect(await collect(chunks)).toBe('中文测试')
  })

  it('4. 噪音行不炸：event: / 空行 / 空 data / [DONE]', async () => {
    const text = await collect([
      'event: message\n',
      '\n',
      'data:\n',
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n',
      'data: [DONE]\n',
    ])
    expect(text).toBe('ok')
  })
})
