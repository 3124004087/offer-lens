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

  // 抽成独立函数：循环里和收尾都要用，避免写两份
  const parseLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') return
    try {
      const delta: string = JSON.parse(data).choices?.[0]?.delta?.content ?? ''
      if (delta) onDelta?.(delta)
    } catch {
      // 单个分片坏掉不影响后续，静默跳过
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    // stream: true —— 让 decoder 把被切断的多字节汉字先存着，等下一个包补齐
    buffer += decoder.decode(value, { stream: true })

    // SSE 以 \n 分隔；最后一段可能被网络包切断，必须留在 buffer
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(parseLine)
  }

  // 收尾一：decoder 无参 decode 会把压在内部的那半个汉字吐出来（flush）
  buffer += decoder.decode()
  // 收尾二：最后一行通常没有 \n 结尾，不能跟着 buffer 一起被扔，单独走一遍
  buffer.split('\n').forEach(parseLine)
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

    // 每次请求持有自己的 controller，供 finally 里做引用比对
    const myController = new AbortController()
    controller = myController

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: myController.signal,   // 不用外层 controller，防止被后来者换掉
      })
      if (!res.ok || !res.body) {
        // 代理把原因写在 body 里：{ error: 'missing_api_key' } / { error:'upstream_failed', detail }
        // res.json() 只能读一次 body，读完抛出后就不会再进 consume，两者不冲突
        const info = await res.json().catch(() => null)
        const reason = info?.detail || info?.error || ''
        if (res.status === 401) throw new Error('Key 无效，检查 .env 里的 DEEPSEEK_API_KEY')
        if (res.status === 429) throw new Error('请求太频繁，等 10 秒再点')
        throw new Error(`请求失败（${res.status}）${String(reason).slice(0, 80)}`)
      }

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
      // 只清自己那份：旧请求晚到的 finally 不能把新请求的 controller 清成 null
      if (controller === myController) {
        controller = null
        loading.value = false
      }
    }
  }

  function stop() {
    controller?.abort()   // 不再手动改 loading，收尾统一交给 finally
  }

  onScopeDispose(stop)   // 组件卸载自动中断，防止回调往已销毁实例写值
  return { text, loading, error, run, stop }
}
