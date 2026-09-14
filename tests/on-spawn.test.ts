import { describe, expect, test, tier } from 'claude-code/testing'

import Model from '../hooks/model'
import Fixtures from './fixtures'

tier('user')

describe('on-spawn', () => {
  test('a spawn under main becomes a running node with the spawn facts', () => {
    const state = Model.onSpawn(
      Model.initialState(0),
      Fixtures.spawnOf('a', { model: 'claude-sonnet-5', prompt: 'p'.repeat(200), name: 'scout' }),
      10,
    )
    const node = Model.nodeOf(state, 'a')

    expect(node?.status).toBe('running')
    expect(node?.parentId).toBe(null)
    expect(node?.source).toBe('spawn')
    expect(node?.spawnedAt).toBe(10)
    expect(node?.model).toBe('claude-sonnet-5')
    expect(node?.name).toBe('scout')
    expect(node?.promptExcerpt).toHaveLength(120)
    expect(state.events[0]?.kind).toBe('agent.spawn')
  })

  test('a spawn inside a subagent hangs under that parent', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onSpawn(state, Fixtures.spawnOf('b', { parentAgentId: 'a' }), 2)

    expect(Model.nodeOf(state, 'b')?.parentId).toBe('a')
  })

  test('a spawn of an id the list already added keeps the listed status', () => {
    let state = Model.initialState(0)
    state = Model.withNode(
      state,
      Model.newNode(
        { id: 'a', parentId: null, source: 'list', type: 'Explore', description: 'listed', status: 'unknown' },
        1,
      ),
    )
    state = Model.onSpawn(state, Fixtures.spawnOf('a', { description: 'spawned' }), 2)
    const node = Model.nodeOf(state, 'a')

    expect(node?.status).toBe('unknown')
    expect(node?.source).toBe('list')
    expect(node?.description).toBe('spawned')
    expect(node?.spawnedAt).toBe(2)
  })

  test('a refused spawn only logs an event', () => {
    const state = Model.onSpawn(
      Model.initialState(0),
      Fixtures.spawnOf('a', { agentId: undefined, deny: 'depth limit' }),
      3,
    )

    expect(state.nodes.size).toBe(1)
    expect(state.events[0]?.text).toContain('depth limit')
  })
})
