import fs from 'fs'
import path from 'path'
import os from 'os'
import type { ProxyConfig } from '../types'

const CONFIG_PATH = path.join(os.homedir(), '.cc-catalyst', 'config.json')

const DEFAULTS: ProxyConfig = {
  port: 3131,
  historyTrimN: 20,
  enableToolStripping: true,
  enableHistoryTrimming: true,
}

export function readConfig(): ProxyConfig {
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as { proxy?: Partial<ProxyConfig> }
    return { ...DEFAULTS, ...raw.proxy }
  } catch {
    return { ...DEFAULTS }
  }
}
