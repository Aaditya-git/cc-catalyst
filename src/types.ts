export type TaskType =
  | 'file_editing'
  | 'git_work'
  | 'web_research'
  | 'debugging'
  | 'multi_agent'
  | 'general'

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | ContentBlock[]
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

export interface Message {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface AnthropicRequest {
  model: string
  max_tokens: number
  system?: string
  tools?: ToolDefinition[]
  messages: Message[]
  stream?: boolean
  [key: string]: unknown
}

export interface CatalystPlan {
  taskType: TaskType
  toolsToKeep: string[]
  shouldCompressPrompt: boolean
  shouldCompactHistory: boolean
  outputTruncationLimit: number
}

export interface UserProfile {
  toolUsageByTaskType: Record<string, string[]>
}

export interface SessionMetrics {
  originalTokenEstimate: number
  optimizedTokenEstimate: number
  reductionPercent: number
  taskType: TaskType
  timestamp: number
}
