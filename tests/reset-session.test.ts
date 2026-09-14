import { describe, expect, test, tier } from 'claude-code/testing'

import Model from '../hooks/model'
import Names from '../hooks/names'
import Fixtures from './fixtures'

tier('user')

describe('reset-session', () => {
  test('resetSession starts the tree over, keeping the pane', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onSpawn(state, Fixtures.spawnOf('b'), 2)
    state = Model.withPane(state, { isBelievedOpen: true, columns: 150 })

    state = Model.resetSession(state, 9)

    expect(state.nodes.size).toBe(1)
    expect(state.events).toHaveLength(0)
    expect(state.pane.isBelievedOpen).toBe(true)
    expect(state.pane.columns).toBe(150)
    expect(Model.nodeOf(state, Names.ROOT_ID)?.firstSeenAt).toBe(9)
  })
})
