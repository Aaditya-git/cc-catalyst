import { buildPlan } from '../../../src/catalyst/planner'
import { AnthropicRequest, UserProfile } from '../../../src/types'

const makeRequest = (userMessage: string): AnthropicRequest => ({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  messages: [{ role: 'user', content: userMessage }]
})

const emptyProfile: UserProfile = { toolUsageByTaskType: {} }

describe('buildPlan', () => {
  it('detects file_editing from message content', () => {
    const plan = buildPlan(makeRequest('fix the bug in auth.ts'), emptyProfile)
    expect(plan.taskType).toBe('file_editing')
    expect(plan.toolsToKeep).toContain('Read')
    expect(plan.toolsToKeep).toContain('Edit')
  })

  it('detects git_work from message content', () => {
    const plan = buildPlan(makeRequest('commit my changes and push to main'), emptyProfile)
    expect(plan.taskType).toBe('git_work')
  })

  it('detects web_research from message content', () => {
    const plan = buildPlan(makeRequest('search for the latest React docs'), emptyProfile)
    expect(plan.taskType).toBe('web_research')
    expect(plan.toolsToKeep).toContain('WebFetch')
  })

  it('detects debugging from message content', () => {
    const plan = buildPlan(makeRequest('why is my test failing with this error'), emptyProfile)
    expect(plan.taskType).toBe('debugging')
  })

  it('falls back to general for ambiguous messages', () => {
    const plan = buildPlan(makeRequest('hello how are you'), emptyProfile)
    expect(plan.taskType).toBe('general')
    expect(plan.toolsToKeep).toHaveLength(0)
  })

  it('enables history compaction when messages > 10', () => {
    const request: AnthropicRequest = {
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: Array.from({ length: 12 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `msg ${i}`
      }))
    }
    const plan = buildPlan(request, emptyProfile)
    expect(plan.shouldCompactHistory).toBe(true)
  })

  it('merges profile tools with default tool set', () => {
    const profile: UserProfile = {
      toolUsageByTaskType: { file_editing: ['Read', 'Edit', 'Bash', 'WebFetch'] }
    }
    const plan = buildPlan(makeRequest('fix the bug in auth.ts'), profile)
    expect(plan.toolsToKeep).toContain('WebFetch')
  })
})
