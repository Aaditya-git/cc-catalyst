import http from 'http'
import https from 'https'
import { createOptimizer } from '../catalyst/optimizer'
import { createProfile } from '../adaptive/profile'
import { AnthropicRequest, UserProfile } from '../types'

const profile = createProfile()
const optimizer = createOptimizer(() => profile.load())

export function buildOptimizedBody(
  body: AnthropicRequest,
  userProfile: UserProfile
): AnthropicRequest {
  const opt = createOptimizer(() => userProfile)
  return opt.optimize(body)
}

export async function interceptRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const rawBody = await bufferBody(req)
  const parsed: AnthropicRequest = JSON.parse(rawBody.toString())
  const optimized = optimizer.optimize(parsed)
  await forwardToAnthropic(optimized, req.headers, res)
}

function bufferBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function forwardToAnthropic(
  body: AnthropicRequest,
  originalHeaders: http.IncomingMessage['headers'],
  res: http.ServerResponse
): Promise<void> {
  const payload = JSON.stringify(body)
  const upstream = process.env.CC_CATALYST_UPSTREAM ?? 'https://api.anthropic.com'
  const url = new URL(upstream)
  const isHttps = url.protocol === 'https:'

  const options: http.RequestOptions = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: '/v1/messages',
    method: 'POST',
    headers: {
      ...originalHeaders,
      host: url.hostname,
      'content-length': Buffer.byteLength(payload),
      'content-type': 'application/json'
    }
  }

  const transport = isHttps ? https : http

  return new Promise((resolve, reject) => {
    const proxyReq = transport.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode!, proxyRes.headers)
      proxyRes.pipe(res)
      proxyRes.on('end', resolve)
    })
    proxyReq.on('error', reject)
    proxyReq.write(payload)
    proxyReq.end()
  })
}
