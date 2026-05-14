import http from 'http'
import { appendMetric } from './store'

export function captureAndForward(
  proxyRes: http.IncomingMessage,
  res: http.ServerResponse,
  model: string,
  estimatedOriginal: number
): void {
  const isStreaming =
    (proxyRes.headers['content-type'] ?? '').includes('text/event-stream')

  if (isStreaming) {
    captureStreaming(proxyRes, res, model, estimatedOriginal)
  } else {
    captureNonStreaming(proxyRes, res, model, estimatedOriginal)
  }
}

function captureStreaming(
  proxyRes: http.IncomingMessage,
  res: http.ServerResponse,
  model: string,
  estimatedOriginal: number
): void {
  res.writeHead(proxyRes.statusCode!, proxyRes.headers)

  let inputTokens: number | null = null
  let buffer = ''

  proxyRes.on('data', (chunk: Buffer) => {
    res.write(chunk)

    if (inputTokens !== null) return

    buffer += chunk.toString()
    const match = buffer.match(/"type"\s*:\s*"message_start"[^}]*"input_tokens"\s*:\s*(\d+)/)
    if (match) {
      inputTokens = parseInt(match[1], 10)
      buffer = ''
    }
    // keep buffer bounded
    if (buffer.length > 4096) buffer = buffer.slice(-4096)
  })

  proxyRes.on('end', () => {
    res.end()
    if (inputTokens !== null) {
      appendMetric({ ts: Date.now(), model, estimatedOriginal, realOptimized: inputTokens })
    }
  })
}

function captureNonStreaming(
  proxyRes: http.IncomingMessage,
  res: http.ServerResponse,
  model: string,
  estimatedOriginal: number
): void {
  const chunks: Buffer[] = []

  proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk))

  proxyRes.on('end', () => {
    const body = Buffer.concat(chunks)
    res.writeHead(proxyRes.statusCode!, proxyRes.headers)
    res.end(body)

    try {
      const parsed = JSON.parse(body.toString())
      const inputTokens: number | undefined = parsed?.usage?.input_tokens
      if (typeof inputTokens === 'number') {
        appendMetric({ ts: Date.now(), model, estimatedOriginal, realOptimized: inputTokens })
      }
    } catch {
      // not JSON or no usage field — skip
    }
  })
}
