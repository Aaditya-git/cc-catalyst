import { stripTools } from '../../../src/proxy/middleware/tool-stripper'

const body = {
  model: 'claude-sonnet-4-6',
  messages: [{ role: 'user', content: 'hello' }],
  tools: [
    { name: 'Bash', description: 'run shell', input_schema: {} },
    { name: 'WebSearch', description: 'search web', input_schema: {} },
    { name: 'Read', description: 'read file', input_schema: {} },
  ],
}

describe('stripTools', () => {
  it('removes tools in neverUsed list', () => {
    const result = stripTools(body, ['WebSearch'])
    const names = (result.body as typeof body).tools.map(t => t.name)
    expect(names).not.toContain('WebSearch')
    expect(names).toContain('Bash')
    expect(names).toContain('Read')
  })

  it('reports removed tool names', () => {
    const result = stripTools(body, ['WebSearch'])
    expect(result.removed).toEqual(['WebSearch'])
  })

  it('reports token savings as removed.length * 80', () => {
    const result = stripTools(body, ['WebSearch', 'Read'])
    expect(result.tokensSaved).toBe(160)
  })

  it('returns original body unchanged when no tools match', () => {
    const result = stripTools(body, ['NotATool'])
    expect(result.removed).toEqual([])
    expect(result.tokensSaved).toBe(0)
    expect((result.body as typeof body).tools).toHaveLength(3)
  })

  it('returns original body unchanged when body has no tools array', () => {
    const noTools = { model: 'claude-sonnet-4-6', messages: [] }
    const result = stripTools(noTools, ['WebSearch'])
    expect(result.removed).toEqual([])
    expect(result.body).toBe(noTools)
  })

  it('returns original body unchanged when neverUsed is empty', () => {
    const result = stripTools(body, [])
    expect(result.removed).toEqual([])
    expect(result.body).toBe(body)
  })
})
