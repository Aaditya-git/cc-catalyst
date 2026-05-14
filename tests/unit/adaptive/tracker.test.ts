import { createTracker } from '../../../src/adaptive/tracker'

describe('tracker', () => {
  it('records a tool call for a task type', () => {
    const tracker = createTracker()
    tracker.record('file_editing', 'WebFetch')
    expect(tracker.getToolsUsed('file_editing')).toContain('WebFetch')
  })

  it('deduplicates tool names per task type', () => {
    const tracker = createTracker()
    tracker.record('file_editing', 'Read')
    tracker.record('file_editing', 'Read')
    expect(tracker.getToolsUsed('file_editing').filter(t => t === 'Read')).toHaveLength(1)
  })

  it('tracks different task types independently', () => {
    const tracker = createTracker()
    tracker.record('file_editing', 'Read')
    tracker.record('git_work', 'Bash')
    expect(tracker.getToolsUsed('file_editing')).not.toContain('Bash')
    expect(tracker.getToolsUsed('git_work')).not.toContain('Read')
  })

  it('returns empty array for unknown task type', () => {
    const tracker = createTracker()
    expect(tracker.getToolsUsed('general')).toEqual([])
  })
})
