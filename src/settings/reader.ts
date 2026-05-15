import fs from 'fs'

export function stripJsonComments(src: string): string {
  let out = ''
  let i = 0
  let inString = false
  let stringChar = ''
  let inLine = false
  let inBlock = false

  while (i < src.length) {
    const c = src[i]
    const next = i + 1 < src.length ? src[i + 1] : ''

    if (inLine) {
      if (c === '\n') { inLine = false; out += c }
      i++; continue
    }
    if (inBlock) {
      if (c === '*' && next === '/') { inBlock = false; i += 2; continue }
      i++; continue
    }
    if (inString) {
      out += c
      if (c === '\\' && i + 1 < src.length) { out += src[i + 1]; i += 2; continue }
      if (c === stringChar) inString = false
      i++; continue
    }
    if (c === '"' || c === "'") { inString = true; stringChar = c; out += c; i++; continue }
    if (c === '/' && next === '/') { inLine = true; i += 2; continue }
    if (c === '/' && next === '*') { inBlock = true; i += 2; continue }
    out += c; i++
  }

  return out.replace(/,(\s*[}\]])/g, '$1')
}

export function readSettings(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {}
  const raw = fs.readFileSync(filePath, 'utf8').trim()
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, unknown> } catch { /* try JSONC */ }
  try { return JSON.parse(stripJsonComments(raw)) as Record<string, unknown> } catch {
    process.stderr.write(`cc-catalyst: cannot parse ${filePath} — skipping\n`)
    return {}
  }
}
