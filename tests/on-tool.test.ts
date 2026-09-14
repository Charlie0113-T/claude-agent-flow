import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Model from '../hooks/model'
import Names from '../hooks/names'
import Fixtures from './fixtures'

tier('user')

describe('on-tool', () => {
  test('a call marks the agent busy in that tool, and its end records the call', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onToolStart(state, { agentId: 'a', tool: 'Bash', toolUseId: 't1' }, 10)

    expect(Model.nodeOf(state, 'a')?.activity).toEqual({ kind: 'tool', tool: 'Bash', since: 10, toolUseId: 't1' })

    state = Model.onToolEnd(state, { agentId: 'a', tool: 'Bash', isError: true }, 25)
    const node = Model.nodeOf(state, 'a')

    expect(node?.activity).toEqual({ kind: 'idle' })
    expect(node?.toolCalls).toBe(1)
    expect(node?.errors).toBe(1)
    expect(node?.recentTools).toEqual([{ tool: 'Bash', startedAt: 10, durationMs: 15, isError: true }])
    expect(node?.lastEventAt).toBe(25)
  })

  test('the main loop\'s calls land on the root node', () => {
    const state = Model.onToolStart(Model.initialState(0), { tool: 'Agent' }, 3)

    expect(Model.nodeOf(state, Names.ROOT_ID)?.activity).toEqual({ kind: 'tool', tool: 'Agent', since: 3 })
    expect(state.nodes.size).toBe(1)
  })

  test('a call from an unknown loop creates an event-sourced node', () => {
    const state = Model.onToolStart(Model.initialState(0), { agentId: 'wf-1234567890', tool: 'Read' }, 3)

    expect(Model.nodeOf(state, 'wf-1234567890')?.source).toBe('event')
    expect(Model.nodeOf(state, 'wf-1234567890')?.activity.kind).toBe('tool')
  })

  test('a call from a finished agent puts it back to running', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onTurnComplete(state, { agentId: 'a', reason: 'answer', durationMs: 5 }, 6)
    state = Model.onToolStart(state, { agentId: 'a', tool: 'Grep' }, 9)

    expect(Model.nodeOf(state, 'a')?.status).toBe('running')
    expect(Model.nodeOf(state, 'a')?.endedAt).toBe(undefined)
  })

  test('only the newest RECENT_TOOLS calls are kept', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)

    for (let i = 0; i < Limits.RECENT_TOOLS + 2; i += 1) {
      state = Model.onToolStart(state, { agentId: 'a', tool: `T${i}` }, i * 2)
      state = Model.onToolEnd(state, { agentId: 'a', tool: `T${i}`, isError: false }, i * 2 + 1)
    }

    const node = Model.nodeOf(state, 'a')

    expect(node?.recentTools).toHaveLength(Limits.RECENT_TOOLS)
    expect(node?.recentTools[0]?.tool).toBe('T2')
    expect(node?.toolCalls).toBe(Limits.RECENT_TOOLS + 2)
  })

  test('an end without a start is still counted', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onToolEnd(state, { agentId: 'a', tool: 'Bash', isError: false }, 4)

    expect(Model.nodeOf(state, 'a')?.toolCalls).toBe(1)
    expect(Model.nodeOf(state, 'a')?.recentTools[0]?.durationMs).toBe(0)
  })
})
