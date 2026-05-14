import { AnthropicRequest, CatalystPlan, TaskType, UserProfile } from '../types'

const TASK_PATTERNS: Record<Exclude<TaskType, 'general'>, RegExp> = {
  file_editing: /\b(edit|fix|change|update|refactor|add|remove|delete|create|modify|implement|write)\b/i,
  git_work: /\b(commit|push|pull|branch|merge|rebase|git|diff|stash|checkout)\b/i,
  web_research: /\b(search|fetch|url|website|docs|lookup|online|http)\b/i,
  debugging: /\b(debug|error|exception|bug|fail|crash|not working|why|issue)\b/i,
  multi_agent: /\b(agent|parallel|subagent|spawn|delegate)\b/i
}

const DEFAULT_TOOL_SETS: Record<TaskType, string[]> = {
  file_editing: ['Read', 'Edit', 'Write', 'Bash', 'Glob', 'Grep'],
  git_work: ['Bash', 'Read'],
  web_research: ['WebFetch', 'WebSearch', 'Read'],
  debugging: ['Read', 'Bash', 'Grep', 'Glob'],
  multi_agent: ['Agent', 'Read', 'Bash', 'Edit', 'Write'],
  general: []
}

export function buildPlan(request: AnthropicRequest, profile: UserProfile): CatalystPlan {
  const userMessage = extractLastUserMessage(request)
  const taskType = detectTaskType(userMessage)
  const toolsToKeep = resolveToolSet(taskType, profile)

  return {
    taskType,
    toolsToKeep,
    shouldCompressPrompt: true,
    shouldCompactHistory: request.messages.length > 10,
    outputTruncationLimit: 150
  }
}

function detectTaskType(message: string): TaskType {
  for (const [type, pattern] of Object.entries(TASK_PATTERNS)) {
    if (pattern.test(message)) return type as TaskType
  }
  return 'general'
}

function resolveToolSet(taskType: TaskType, profile: UserProfile): string[] {
  const profileTools = profile.toolUsageByTaskType[taskType]
  if (profileTools && profileTools.length > 0) {
    return [...new Set([...DEFAULT_TOOL_SETS[taskType], ...profileTools])]
  }
  return DEFAULT_TOOL_SETS[taskType]
}

function extractLastUserMessage(request: AnthropicRequest): string {
  const userMsgs = request.messages.filter(m => m.role === 'user')
  const last = userMsgs[userMsgs.length - 1]
  if (!last) return ''
  if (typeof last.content === 'string') return last.content
  return last.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join(' ')
}
