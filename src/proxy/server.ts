import express from 'express'
import https from 'https'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { stripTools } from './middleware/tool-stripper'
import { trimHistory } from './middleware/history-trimmer'
import { readConfig } from './config'
import { getGlobalNeverUsed } from './patterns'

const LOG_FILE = path.join(os.homedir(), '.cc-catalyst', 'proxy.log')

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch { /* ignore log errors */ }
}

const app = express()
app.use(express.json({ limit: '10mb' }))

app.post('/v1/messages', (req, res) => {
  const config = readConfig()
  let body: unknown = req.body
  const reports: string[] = []

  try {
    if (config.enableToolStripping) {
      const neverUsed = getGlobalNeverUsed()
      if (neverUsed.length > 0) {
        const result = stripTools(body, neverUsed)
        body = result.body
        if (result.removed.length > 0) {
          reports.push(`stripped ${result.removed.length} tools (~${result.tokensSaved} tokens): ${result.removed.join(', ')}`)
        }
      }
    }

    if (config.enableHistoryTrimming) {
      const result = trimHistory(body, config.historyTrimN)
      body = result.body
      if (result.removed > 0) {
        reports.push(`trimmed ${result.removed} messages (~${result.tokensSaved} tokens)`)
      }
    }
  } catch (err) {
    log(`[WARN] Modification failed, falling through: ${String(err)}`)
    body = req.body
  }

  if (reports.length > 0) {
    log(`[CATALYST PROXY] ${reports.join(' | ')}`)
  }

  forward(req, res, body)
})

// Passthrough for all other routes
app.all(/.*/, (req, res) => {
  forward(req, res, req.body)
})

function forward(req: express.Request, res: express.Response, body: unknown) {
  const bodyStr = body !== undefined ? JSON.stringify(body) : ''
  const headers: Record<string, string> = {}

  for (const [key, value] of Object.entries(req.headers)) {
    if (['host', 'content-length', 'connection', 'transfer-encoding'].includes(key)) continue
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(', ') : value
    }
  }

  headers['host'] = 'api.anthropic.com'
  headers['content-type'] = 'application/json'
  headers['content-length'] = String(Buffer.byteLength(bodyStr))

  const options: https.RequestOptions = {
    hostname: 'api.anthropic.com',
    path: req.originalUrl,
    method: req.method,
    headers,
  }

  const proxyReq = https.request(options, proxyRes => {
    const responseHeaders: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (value !== undefined) responseHeaders[key] = value
    }
    res.writeHead(proxyRes.statusCode!, responseHeaders)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', err => {
    log(`[ERROR] Forward failed: ${err.message}`)
    if (!res.headersSent) res.status(502).json({ error: 'proxy_error', message: err.message })
  })

  if (bodyStr) proxyReq.write(bodyStr)
  proxyReq.end()
}

const config = readConfig()
app.listen(config.port, () => {
  log(`cc-catalyst proxy listening on port ${config.port}`)
})
