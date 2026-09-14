import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Model from '../hooks/model'
import Names from '../hooks/names'
import Fixtures from './fixtures'

tier('user')

const NONE: ReadonlySet<string> = new Set()

function nested(): Model.FlowState {
  let state = Model.onTurnStart(Model.initialState(0), 0)
  state = Model.onToolStart(state, { tool: 'Agent' }, 500)
  state = Model.onSpawn(state, Fixtures.spawnOf('a', { subagentType: 'general-purpose', description: 'Refactor auth' }), 1000)
  state = Model.onSpawn(state, Fixtures.spawnOf('b', { parentAgentId: 'a', description: 'Find callers' }), 2000)
  state = Model.onToolStart(state, { agentId: 'b', tool: 'Grep' }, 2100)
  state = Model.onToolEnd(state, { agentId: 'b', tool: 'Grep', isError: false }, 2600)
  state = Model.onTurnComplete(
    state,
    { agentId: 'b', reason: 'answer', durationMs: 8000, usage: { input_tokens: 4000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    10000,
  )
  state = Model.onSpawn(state, Fixtures.spawnOf('c', { description: 'Scan tests' }), 3000)
  state = Model.onPermission(state, { agentId: 'c', tool: 'Bash' }, 4000)

  return state
}

describe('rows-of', () => {
  test('the header counts and the root row say what main is doing', () => {
    const rows = Model.rowsOf(nested(), 12000, NONE)

    expect(rows[0]).toEqual({ kind: 'header', text: 'Agent flow · 3 agents · 2 running · 1 waiting', bold: true })
    expect(rows[1]?.kind).toBe('root')
    expect(rows[1]?.text).toBe('main · busy · Agent 12s')
  })

  test('the tree nests children under parents with box prefixes, in spawn order', () => {
    const texts = Model.rowsOf(nested(), 12000, NONE)
      .filter(row => row.kind === 'node')
      .map(row => row.text)

    expect(texts).toEqual([
      '├─ ● general-purpose "Refactor auth" 11s',
      '│  └─ ✓ Explore "Find callers" 8s ×1 · 4.1k tok',
      '└─ ◐ Explore "Scan tests" 9s · waiting for approval: Bash',
    ])
  })

  test('node rows carry their id, color and expandability; a waiting row is magenta and bold', () => {
    const rows = Model.rowsOf(nested(), 12000, NONE).filter(row => row.kind === 'node')

    expect(rows[0]).toMatchObject({ id: 'a', color: 'yellow', isExpanded: false })
    expect(rows[1]).toMatchObject({ id: 'b', color: 'green', dim: true })
    expect(rows[2]).toMatchObject({ id: 'c', color: 'magenta', bold: true })
  })

  test('an expanded node shows its details indented under it', () => {
    const rows = Model.rowsOf(nested(), 12000, new Set(['b']))
    const at = rows.findIndex(row => row.id === 'b')

    expect(rows[at]?.isExpanded).toBe(true)
    expect(rows[at + 1]).toMatchObject({ kind: 'detail', dim: true })
    expect(rows[at + 1]?.text).toBe('│     model ? · foreground')
    expect(rows[at + 2]?.text).toBe('│     prompt Do task b')
    expect(rows[at + 3]?.text).toBe('│     Grep 1s')
    expect(rows[at + 4]?.text).toBe('│     tokens in 4000 out 100 cache 0/0')
    expect(rows[at + 5]?.text).toBe('│     id b')
  })

  test('a slow tool call is marked, a failed node is red with its status', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 0)
    state = Model.onToolStart(state, { agentId: 'a', tool: 'Bash' }, 1000)
    const slow = Model.rowsOf(state, 2000 + Limits.SLOW_TOOL_MS, NONE).find(row => row.id === 'a')

    expect(slow?.text).toBe('└─ ● Explore "task a" 32s · Bash 31s !')
    expect(slow?.color).toBe('yellow')

    state = Model.onTurnComplete(state, { agentId: 'a', reason: 'error', durationMs: 1 }, 5000)
    const failed = Model.rowsOf(state, 9000, NONE).find(row => row.id === 'a')

    expect(failed?.text).toBe('└─ ✗ Explore "task a" 5s ×0 [failed]')
    expect(failed?.color).toBe('red')
  })

  test('the call count shows during a call, and one agent is singular', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 0)
    state = Model.onToolStart(state, { agentId: 'a', tool: 'Grep' }, 1000)
    state = Model.onToolEnd(state, { agentId: 'a', tool: 'Grep', isError: false }, 2000)
    state = Model.onToolStart(state, { agentId: 'a', tool: 'Read' }, 3000)
    const rows = Model.rowsOf(state, 4000, NONE)

    expect(rows[0]?.text).toBe('Agent flow · 1 agent · 1 running · 0 waiting')
    expect(rows.find(row => row.id === 'a')?.text).toBe('└─ ● Explore "task a" 4s · Read 1s ×1')
  })

  test('unknown, quiet and named nodes render their own glyph, text and color', () => {
    let state = Model.reconcile(Model.initialState(0), [{ id: 'a', description: 'parked one', type: 'general-purpose', status: 'parked', name: 'scout' }], 1000)
    state = Model.onSpawn(state, Fixtures.spawnOf('b'), 2000)
    const rows = Model.rowsOf(state, 3000 + Limits.QUIET_MS, NONE)

    expect(rows.find(row => row.id === 'a')).toMatchObject({ text: '├─ ○ general-purpose scout "parked one" ~2m02s [parked]', color: undefined })
    expect(rows.find(row => row.id === 'b')).toMatchObject({ text: '└─ ● Explore "task b" 2m01s · quiet 2m', color: 'gray' })
  })

  test('the header counts unlisted loops', () => {
    const state = Model.onToolStart(Model.initialState(0), { agentId: 'wf-1', tool: 'Read' }, 1)

    expect(Model.rowsOf(state, 2, NONE)[0]?.text).toBe('Agent flow · 1 agent · 1 running · 0 waiting · 1 unlisted')
  })

  test('with no agents the tree is one dim empty row', () => {
    const rows = Model.rowsOf(Model.initialState(0), 1, NONE)

    expect(rows.map(row => row.kind)).toEqual(['header', 'root', 'empty'])
    expect(rows[2]).toEqual({ kind: 'empty', text: `   ${Names.NO_AGENTS_TEXT}`, dim: true })
  })

  test('unlisted loops sit in a collapsed group that expands by its key', () => {
    let state = Model.onToolStart(Model.initialState(0), { agentId: 'wf-12345678', tool: 'Read' }, 1)
    const collapsed = Model.rowsOf(state, 2, NONE)
    const group = collapsed.find(row => row.kind === 'group')

    expect(group).toMatchObject({ id: Names.UNLISTED_KEY, text: `▸ ${Names.UNLISTED_GROUP_LABEL} (1)`, isExpanded: false })
    expect(collapsed.some(row => row.id === 'wf-12345678')).toBe(false)

    const expanded = Model.rowsOf(state, 2, new Set([Names.UNLISTED_KEY]))

    expect(expanded.find(row => row.kind === 'group')?.text).toBe(`▾ ${Names.UNLISTED_GROUP_LABEL} (1)`)
    expect(expanded.find(row => row.id === 'wf-12345678')?.text).toBe('   └─ ● loop "wf-12345" ~0s · Read 0s')
    void state
  })

  test('the last event closes the list, dim', () => {
    const rows = Model.rowsOf(nested(), 12000, NONE)

    expect(rows.at(-1)).toEqual({ kind: 'event', text: 'last: permission c waiting for approval: Bash', dim: true })
  })

  test('inline rows keep the header, the rows that need attention and a hint, at most INLINE_MAX_ROWS', () => {
    const rows = Model.inlineRowsOf(nested(), 12000)

    expect(rows[0]?.kind).toBe('header')
    expect(rows[1]?.text).toBe('◐ Explore "Scan tests" 9s · waiting for approval: Bash')
    expect(rows.at(-1)).toEqual({ kind: 'hint', text: Names.WIDEN_TEXT, dim: true })
    expect(rows.length).toBeLessThanOrEqual(Limits.INLINE_MAX_ROWS + 2)
  })

  test('inline rows fall back to running agents when nothing needs attention', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onSpawn(state, Fixtures.spawnOf('b'), 2)
    const rows = Model.inlineRowsOf(state, 3000)

    expect(rows.filter(row => row.kind === 'node').map(row => row.id)).toEqual(['a', 'b'])
  })
})
