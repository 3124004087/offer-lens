// composables/useAIStream.ts
import { ref, onScopeDispose } from 'vue'

interface StreamPayload {
  system?: string
  user: string
  json?: boolean
}
interface StreamOptions {
  onDelta?: (chunk: string) => void
  onDone?: (full: string) => void
  onError?: (msg: string) => void
}

/**
 * 把 SSE 字节流解析成一段段文字，交给调用方处理。
 * 刻意不碰 text.value：解析只依赖 Web 标准 API，才能脱离组件单独测。
 */
export async function consume(body: ReadableStream<Uint8Array>, onDelta?: (s: string) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    // stream: true —— 让 decoder 把被切断的多字节汉字先存着，等下一个包补齐
    buffer += decoder.decode(value, { stream: true })

    // SSE 以 \n 分隔；最后一段可能被网络包切断，必须留在 buffer
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta: string = json.choices?.[0]?.delta?.content ?? ''
        if (delta) onDelta?.(delta)
      } catch {
        // 单个分片坏掉不影响后续，静默跳过
      }
    }
  }
}

export function useAIStream() {
  const text = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)
  let controller: AbortController | null = null

  async function run(payload: StreamPayload, opts: StreamOptions = {}) {
    if (loading.value) return          // 同一实例只允许一个请求，避免两路 token 混写
    loading.value = true
    text.value = ''
    error.value = null
    controller = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      // 解析细节交给 consume，这里只负责「把产物写进响应式状态」
      await consume(res.body, (delta) => {
        text.value += delta
        opts.onDelta?.(delta)
      })

      opts.onDone?.(text.value)
    } catch (e: any) {
      if (e?.name === 'AbortError') return   // 用户主动取消，不算错误
      error.value = e?.message ?? '未知错误'
      opts.onError?.(error.value!)
    } finally {
      loading.value = false
      controller = null
    }
  }

  function stop() {
    controller?.abort()
    loading.value = false
  }

  onScopeDispose(stop)   // 组件卸载自动中断，防止回调往已销毁实例写值
  return { text, loading, error, run, stop }
}
