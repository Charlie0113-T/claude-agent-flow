import { describe, expect, test, tier } from 'claude-code/testing'

import Model from '../hooks/model'
import Views from '../hooks/views'
import Fixtures from './fixtures'

tier('user')

describe('text-view', () => {
  test('the text tree is the rows, one per line, in order', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1000)
    state = Model.onSpawn(state, Fixtures.spawnOf('b', { parentAgentId: 'a' }), 2000)
    const rows = Model.rowsOf(state, 5000, new Set())
    const text = Views.textView(rows)
    const lines = text.split('\n')

    expect(lines).toHaveLength(rows.length)
    expect(lines[0]).toBe('Agent flow · 2 agents · 2 running · 0 waiting')
    expect(lines[1]).toBe('main · idle')
    expect(lines[2]).toBe('└─ ● Explore "task a" 4s')
    expect(lines[3]).toBe('   └─ ● Explore "task b" 3s')
  })

  test('an empty tree still prints the header, the root and the note', () => {
    const text = Views.textView(Model.rowsOf(Model.initialState(0), 1, new Set()))

    expect(text).toContain('no subagents yet')
  })
})
