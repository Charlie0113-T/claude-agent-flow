import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Model from '../hooks/model'
import Fixtures from './fixtures'

tier('user')

const nodeAfter = (state: Model.FlowState) => Model.nodeOf(state, 'a') as Model.FlowNode

describe('signal-of', () => {
  test('a permission wait is the waiting signal', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onPermission(state, { agentId: 'a', tool: 'Bash' }, 2)

    expect(Model.signalOf(nodeAfter(state), 3)).toBe('waiting')
  })

  test('a tool call longer than SLOW_TOOL_MS is slow, a shorter one is nothing', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onToolStart(state, { agentId: 'a', tool: 'Bash' }, 10)

    expect(Model.signalOf(nodeAfter(state), 10 + Limits.SLOW_TOOL_MS)).toBe('none')
    expect(Model.signalOf(nodeAfter(state), 11 + Limits.SLOW_TOOL_MS)).toBe('slow')
  })

  test('a running idle agent with no event for QUIET_MS is quiet; a finished one is not', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)

    expect(Model.signalOf(nodeAfter(state), 2 + Limits.QUIET_MS)).toBe('quiet')

    state = Model.onTurnComplete(state, { agentId: 'a', reason: 'answer', durationMs: 1 }, 2)

    expect(Model.signalOf(nodeAfter(state), 3 + Limits.QUIET_MS)).toBe('none')
  })
})
