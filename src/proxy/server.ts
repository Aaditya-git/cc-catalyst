import http from 'http'
import https from 'https'
import { interceptRequest } from './interceptor'

const PORT = parseInt(process.env.CC_CATALYST_PORT ?? '8080', 10)
const HOST = '127.0.0.1'

function passthroughRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  const options: https.RequestOptions = {
    hostname: 'api.anthropic.com',
    port: 443,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'api.anthropic.com' }
  }

  const proxyReq = https.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode!, proxyRes.headers)
    proxyRes.pipe(res)
  })

  req.pipe(proxyReq)
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200)
      res.end('ok')
    } else if (req.method === 'POST' && req.url === '/v1/messages') {
      await interceptRequest(req, res)
    } else {
      passthroughRequest(req, res)
    }
  } catch (err) {
    process.stderr.write(`[cc-catalyst] proxy error: ${err}\n`)
    if (!res.headersSent) {
      res.writeHead(502)
      res.end('cc-catalyst proxy error')
    }
  }
})

server.listen(PORT, HOST, () => {
  process.stdout.write(`[cc-catalyst] proxy listening on http://${HOST}:${PORT}\n`)
})

export { server }
