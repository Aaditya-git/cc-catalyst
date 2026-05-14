import { AnthropicRequest, CatalystPlan } from '../../types'

export function applyToolPruner(
  request: AnthropicRequest,
  plan: CatalystPlan
): AnthropicRequest {
  if (!request.tools || request.tools.length === 0) return request
  if (plan.taskType === 'general' || plan.toolsToKeep.length === 0) return request

  const kept = request.tools.filter(tool =>
    plan.toolsToKeep.some(name =>
      tool.name.toLowerCase().includes(name.toLowerCase())
    )
  )

  if (kept.length === 0) return request

  return { ...request, tools: kept }
}
