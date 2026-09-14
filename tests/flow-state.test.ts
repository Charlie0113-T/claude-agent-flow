import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Model from '../hooks/model'
import Names from '../hooks/names'

tier('user')

describe('flow-state', () => {
  test('the initial state holds an idle root and nothing else', () => {
    const state = Model.initialState(1000)

    expect(state.nodes.size).toBe(1)
    expect(Model.nodeOf(state, Names.ROOT_ID)?.status).toBe('completed')
    expect(Model.nodeOf(state, Names.ROOT_ID)?.source).toBe('root')
    expect(state.events).toHaveLength(0)
    expect(state.pane.isBelievedOpen).toBe(false)
  })

  test('withNode replaces by id without touching the old state', () => {
    const state = Model.initialState(0)
    const node = Model.newNode(
      { id: 'a', parentId: null, source: 'spawn', type: 'Explore', description: 'x' },
      5,
    )
    const next = Model.withNode(state, node)

    expect(state.nodes.size).toBe(1)
    expect(next.nodes.size).toBe(2)
    expect(Model.nodeOf(next, 'a')?.firstSeenAt).toBe(5)
    expect(Model.nodeOf(next, 'a')?.status).toBe('running')
  })

  test('withEvent keeps only the newest EVENT_LOG_SIZE events', () => {
    let state = Model.initialState(0)

    for (let i = 0; i < Limits.EVENT_LOG_SIZE + 3; i += 1) {
      state = Model.withEvent(state, { at: i, kind: 'k', text: `e${i}` })
    }

    expect(state.events).toHaveLength(Limits.EVENT_LOG_SIZE)
    expect(state.events[0]?.text).toBe('e3')
  })

  test('ensureNode adds an event-sourced node for an unknown id and nothing for a known one', () => {
    const state = Model.ensureNode(Model.initialState(0), 'abcdef0123456789', 7)

    expect(Model.nodeOf(state, 'abcdef0123456789')?.source).toBe('event')
    expect(Model.nodeOf(state, 'abcdef0123456789')?.type).toBe('loop')
    expect(Model.nodeOf(state, 'abcdef0123456789')?.description).toBe('abcdef01')
    expect(Model.ensureNode(state, 'abcdef0123456789', 9)).toBe(state)
    expect(Model.ensureNode(state, undefined, 9)).toBe(state)
  })

  test('prune drops the oldest finished leaves once MAX_NODES is exceeded', () => {
    let state = Model.initialState(0)

    for (let i = 0; i < Limits.MAX_NODES + 5; i += 1) {
      state = Model.withNode(
        state,
        Model.newNode(
          { id: `n${i}`, parentId: null, source: 'spawn', type: 'Explore', description: '' },
          i,
        ),
      )
      const node = Model.nodeOf(state, `n${i}`)
      if (node && i < Limits.MAX_NODES) {
        state = Model.withNode(state, { ...node, status: 'completed', endedAt: i })
      }
    }

    const pruned = Model.prune(state)

    expect(pruned.nodes.size).toBe(Limits.MAX_NODES)
    expect(Model.nodeOf(pruned, 'n0')).toBe(undefined)
    expect(Model.nodeOf(pruned, `n${Limits.MAX_NODES + 4}`)?.status).toBe('running')
  })

  test('prune keeps a completed parent whose child is still running', () => {
    let state = Model.initialState(0)
    state = Model.withNode(
      state,
      Model.newNode({ id: 'p', parentId: null, source: 'spawn', type: 'x', description: '', status: 'completed', endedAt: 1 }, 1),
    )
    state = Model.withNode(state, Model.newNode({ id: 'c', parentId: 'p', source: 'spawn', type: 'x', description: '' }, 2))

    for (let i = 0; i < Limits.MAX_NODES; i += 1) {
      state = Model.withNode(
        state,
        Model.newNode(
          { id: `n${i}`, parentId: null, source: 'spawn', type: 'x', description: '', status: 'completed', endedAt: i },
          i,
        ),
      )
    }

    const pruned = Model.prune(state)

    expect(Model.nodeOf(pruned, 'p')).toBeDefined()
    expect(Model.nodeOf(pruned, 'c')).toBeDefined()
    expect(pruned.nodes.size).toBe(Limits.MAX_NODES)
  })
})
