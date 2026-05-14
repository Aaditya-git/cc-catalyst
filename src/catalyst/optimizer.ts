import { AnthropicRequest, UserProfile } from '../types'
import { buildPlan } from './planner'
import { applyToolPruner } from './rules/tool-pruner'
import { applyOutputTruncator } from './rules/output-truncator'
import { applyHistoryCompactor } from './rules/history-compactor'
import { applyPromptCompressor } from './rules/prompt-compressor'

export interface Optimizer {
  optimize(request: AnthropicRequest): AnthropicRequest
}

export function createOptimizer(loadProfile: () => UserProfile): Optimizer {
  return {
    optimize(request: AnthropicRequest): AnthropicRequest {
      const profile = loadProfile()
      const plan = buildPlan(request, profile)

      let optimized = request
      optimized = applyToolPruner(optimized, plan)
      optimized = applyOutputTruncator(optimized, plan)
      optimized = applyHistoryCompactor(optimized, plan)
      optimized = applyPromptCompressor(optimized, plan)

      return optimized
    }
  }
}
