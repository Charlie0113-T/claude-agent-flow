import { describe, expect, test, tier } from 'claude-code/testing'

import Model from '../hooks/model'
import Names from '../hooks/names'
import Fixtures from './fixtures'

tier('user')

describe('on-turn', () => {
  test('turn.start and turn.complete on the main loop toggle the root between busy and idle', () => {
    let state = Model.onTurnStart(Model.initialState(0), 1)

    expect(Model.nodeOf(state, Names.ROOT_ID)?.status).toBe('running')

    state = Model.onTurnComplete(state, { reason: 'answer', durationMs: 9 }, 10)

    expect(Model.nodeOf(state, Names.ROOT_ID)?.status).toBe('completed')
    expect(Model.nodeOf(state, Names.ROOT_ID)?.turns).toBe(1)
  })

  test('a subagent turn ends its node by reason and sums its usage', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onToolStart(state, { agentId: 'a', tool: 'Bash' }, 2)
    state = Model.onTurnComplete(
      state,
      {
        agentId: 'a',
        reason: 'answer',
        durationMs: 40,
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 7 },
      },
      42,
    )
    state = Model.onTurnComplete(
      state,
      {
        agentId: 'a',
        reason: 'answer',
        durationMs: 4,
        usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 1, cache_creation_input_tokens: 1 },
      },
      50,
    )
    const node = Model.nodeOf(state, 'a')

    expect(node?.status).toBe('completed')
    expect(node?.endedAt).toBe(50)
    expect(node?.activity).toEqual({ kind: 'idle' })
    expect(node?.turns).toBe(2)
    expect(node?.usage).toEqual({ input: 11, output: 6, cacheRead: 101, cacheWrite: 8 })
  })

  test('reasons map to statuses', () => {
    expect(Model.statusOfReason('answer')).toBe('completed')
    expect(Model.statusOfReason('error')).toBe('failed')
    expect(Model.statusOfReason('aborted')).toBe('aborted')
    expect(Model.statusOfReason('refusal')).toBe('refusal')
    expect(Model.statusOfReason('something')).toBe('unknown')
  })

  test('a turn of an unknown loop creates an event-sourced node that is then finished', () => {
    const state = Model.onTurnComplete(Model.initialState(0), { agentId: 'wf-9', reason: 'answer', durationMs: 1 }, 5)

    expect(Model.nodeOf(state, 'wf-9')?.source).toBe('event')
    expect(Model.nodeOf(state, 'wf-9')?.status).toBe('completed')
  })
})
