import { fileURLToPath, URL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 让 `npm run dev`（5173）也能用 /api/chat。
 *
 * 为什么要这个：`vercel dev` 启动时会先连 api.vercel.com 拉项目信息，
 * 国内网络经常连不上，直接报 `Error: fetch failed`，整个本地调试就废了。
 * 但 /api/chat 本身只做转发，不依赖 Vercel 的任何能力 —— 所以这里在 Vite
 * 的 dev server 上挂一层中间件，**直接把同一个 handler 跑起来**，逻辑只有一份。
 *
 * 只影响本地开发（apply: 'serve'）；线上仍然走 api/chat.ts 的 Edge Function。
 */
function devApiChat(): Plugin {
  return {
    name: 'dev-api-chat',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req: IncomingMessage, res: ServerResponse) => {
        // handler 内部用的是标准 Request / Response，这里把 Node 的流搬过去
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)

        const request = new Request('http://localhost/api/chat', {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
        })

        const { default: handler } = await import('./api/chat')
        const response = await handler(request)

        res.statusCode = response.status
        // 这几个不能透传：
        // content-encoding —— fetch 已经把 body 解压了，再告诉浏览器是 gzip 会解码失败
        // content-length / transfer-encoding —— 长度由 Node 自己算，写死了反而截断
        const SKIP = new Set(['content-encoding', 'content-length', 'transfer-encoding'])
        response.headers.forEach((value, key) => {
          if (!SKIP.has(key.toLowerCase())) res.setHeader(key, value)
        })

        if (!response.body) {
          res.end()
          return
        }

        // 必须一段一段往下写：一次性 await response.text() 会把流式变成一次性返回
        const reader = response.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
        res.end()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // 第三个参数传 '' 表示读取所有变量，不只是 VITE_ 开头的 ——
  // DEEPSEEK_API_KEY 不能带 VITE_ 前缀（否则会被打进前端产物），
  // 但服务端的 handler 要能从 process.env 拿到它
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [vue(), devApiChat()],
    resolve: {
      alias: {
        // 用 @ 指向 src，避免出现 ../../../ 这种路径
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
    },
  }
})
