export interface SessionHealth {
  sessionId: string
  inputTokens: number
  outputTokens: number
  contextLimit: number
  budgetPercent: number
  model: string
  updatedAt: string
}

export interface ToolCallLog {
  tool: string
  sessionId: string
  timestamp: string
}

export interface LearnedPatterns {
  projectHash: string
  sessionCount: number
  neverUsed: string[]
  alwaysUsed: string[]
  updatedAt: string
}

export interface AuditResult {
  globalClaudeMd: number
  projectClaudeMd: number
  sessionHistory: number
  mcpDescriptions: number
  total: number
  recommendations: string[]
}

export interface HookInput {
  session_id: string
  transcript_path?: string
  tool_name?: string
  tool_input?: unknown
  tool_response?: unknown
  stop_hook_active?: boolean
}

export interface ProxyConfig {
  port: number
  historyTrimN: number
  enableToolStripping: boolean
  enableHistoryTrimming: boolean
}
