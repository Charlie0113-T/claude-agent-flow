import { describe, expect, test, tier } from 'claude-code/testing'

import Model from '../hooks/model'
import Fixtures from './fixtures'

tier('user')

describe('counts-of', () => {
  test('counts agents, running, waiting and unlisted, never the root', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onSpawn(state, Fixtures.spawnOf('b'), 2)
    state = Model.onTurnComplete(state, { agentId: 'b', reason: 'answer', durationMs: 1 }, 3)
    state = Model.onPermission(state, { agentId: 'a', tool: 'Bash' }, 4)
    state = Model.onToolStart(state, { agentId: 'wf-1', tool: 'Read' }, 5)

    expect(Model.countsOf(state)).toEqual({ agents: 3, running: 2, waiting: 1, unlisted: 1 })
  })

  test('a root waiting for approval counts as waiting', () => {
    const state = Model.onPermission(Model.initialState(0), { tool: 'Edit' }, 1)

    expect(Model.countsOf(state)).toEqual({ agents: 0, running: 0, waiting: 1, unlisted: 0 })
  })

  test('token totals read compactly', () => {
    expect(Model.tokensTextOf({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe('')
    expect(Model.tokensTextOf({ input: 800, output: 20, cacheRead: 9, cacheWrite: 9 })).toBe('820 tok')
    expect(Model.tokensTextOf({ input: 4000, output: 120, cacheRead: 0, cacheWrite: 0 })).toBe('4.1k tok')
  })
})
