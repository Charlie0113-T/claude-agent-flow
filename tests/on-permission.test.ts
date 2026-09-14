import { describe, expect, test, tier } from 'claude-code/testing'

import Model from '../hooks/model'
import Names from '../hooks/names'
import Fixtures from './fixtures'

tier('user')

describe('on-permission', () => {
  test('a permission request marks the agent as waiting, naming the tool', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onPermission(state, { agentId: 'a', tool: 'Bash' }, 5)

    expect(Model.nodeOf(state, 'a')?.activity).toEqual({ kind: 'permission', tool: 'Bash', since: 5 })
    expect(state.events.at(-1)?.text).toBe('waiting for approval: Bash')
  })

  test('without an agent id the root waits', () => {
    const state = Model.onPermission(Model.initialState(0), {}, 5)

    expect(Model.nodeOf(state, Names.ROOT_ID)?.activity.kind).toBe('permission')
  })

  test('the next tool event clears the wait', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onPermission(state, { agentId: 'a', tool: 'Bash' }, 5)
    state = Model.onToolEnd(state, { agentId: 'a', tool: 'Bash', isError: false }, 9)

    expect(Model.nodeOf(state, 'a')?.activity).toEqual({ kind: 'idle' })
  })
})
