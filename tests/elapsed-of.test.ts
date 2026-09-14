import { describe, expect, test, tier } from 'claude-code/testing'

import Model from '../hooks/model'
import Fixtures from './fixtures'

tier('user')

describe('elapsed-of', () => {
  test('durations read as seconds below a minute and m/ss above', () => {
    expect(Model.durationTextOf(0)).toBe('0s')
    expect(Model.durationTextOf(12400)).toBe('12s')
    expect(Model.durationTextOf(65000)).toBe('1m05s')
    expect(Model.durationTextOf(3600000)).toBe('60m00s')
  })

  test('a spawned node counts from its spawn to its end or now', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1000)
    const running = Model.nodeOf(state, 'a') as Model.FlowNode

    expect(Model.elapsedOf(running, 13000)).toBe('12s')

    state = Model.onTurnComplete(state, { agentId: 'a', reason: 'answer', durationMs: 1 }, 5000)

    expect(Model.elapsedOf(Model.nodeOf(state, 'a') as Model.FlowNode, 99000)).toBe('4s')
  })

  test('a node the list added counts from first sight with a ~ prefix', () => {
    const state = Model.reconcile(
      Model.initialState(0),
      [{ id: 'a', description: 'd', type: 't', status: 'running' }],
      2000,
    )

    expect(Model.elapsedOf(Model.nodeOf(state, 'a') as Model.FlowNode, 9000)).toBe('~7s')
  })
})
