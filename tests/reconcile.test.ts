import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Model from '../hooks/model'
import Fixtures from './fixtures'

tier('user')

const listed = (id: string, status = 'running', parentId?: string) => ({
  id,
  description: `listed ${id}`,
  type: 'general-purpose',
  status,
  parentId,
})

describe('reconcile', () => {
  test('agents the list names and the tree lacks are added as list-sourced', () => {
    const state = Model.reconcile(Model.initialState(0), [listed('a'), listed('b', 'completed', 'a')], 4)

    expect(Model.nodeOf(state, 'a')?.source).toBe('list')
    expect(Model.nodeOf(state, 'a')?.status).toBe('running')
    expect(Model.nodeOf(state, 'b')?.parentId).toBe('a')
    expect(Model.nodeOf(state, 'b')?.status).toBe('completed')
    expect(Model.nodeOf(state, 'b')?.endedAt).toBe(4)
  })

  test('the list has the last word on status and fills a missing parent', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.onTurnComplete(state, { agentId: 'a', reason: 'answer', durationMs: 1 }, 2)
    state = Model.reconcile(state, [listed('a', 'running')], 3)

    expect(Model.nodeOf(state, 'a')?.status).toBe('running')
    expect(Model.nodeOf(state, 'a')?.source).toBe('spawn')
    expect(Model.nodeOf(state, 'a')?.description).toBe('task a')
  })

  test('an unmapped status is kept raw and shown as unknown', () => {
    const state = Model.reconcile(Model.initialState(0), [listed('a', 'parked')], 1)

    expect(Model.nodeOf(state, 'a')?.status).toBe('unknown')
    expect(Model.nodeOf(state, 'a')?.rawStatus).toBe('parked')
  })

  test('a running node missing from the list is gone after GONE_AFTER_MISSES reconciles', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)

    for (let i = 0; i < Limits.GONE_AFTER_MISSES - 1; i += 1) {
      state = Model.reconcile(state, [], 10 + i)
      expect(Model.nodeOf(state, 'a')?.status).toBe('running')
    }

    state = Model.reconcile(state, [], 20)

    expect(Model.nodeOf(state, 'a')?.status).toBe('gone')
    expect(Model.nodeOf(state, 'a')?.endedAt).toBe(20)
    expect(state.events.at(-1)?.kind).toBe('gone')
  })

  test('a miss streak resets when the list names the node again', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    state = Model.reconcile(state, [], 2)
    state = Model.reconcile(state, [listed('a')], 3)
    state = Model.reconcile(state, [], 4)

    expect(Model.nodeOf(state, 'a')?.status).toBe('running')
    expect(Model.nodeOf(state, 'a')?.misses).toBe(1)
  })

  test('event-sourced and root nodes never go missing, and a listed event node is upgraded', () => {
    let state = Model.onToolStart(Model.initialState(0), { agentId: 'wf-1', tool: 'Read' }, 1)
    state = Model.reconcile(state, [], 2)
    state = Model.reconcile(state, [], 3)

    expect(Model.nodeOf(state, 'wf-1')?.status).toBe('running')

    state = Model.reconcile(state, [listed('wf-1')], 4)

    expect(Model.nodeOf(state, 'wf-1')?.source).toBe('list')
    expect(Model.nodeOf(state, 'wf-1')?.type).toBe('general-purpose')
    expect(Model.nodeOf(state, 'wf-1')?.description).toBe('listed wf-1')
  })

  test('statuses map from the engine\'s words', () => {
    expect(Model.statusOfListed('running')).toBe('running')
    expect(Model.statusOfListed('pending')).toBe('running')
    expect(Model.statusOfListed('completed')).toBe('completed')
    expect(Model.statusOfListed('failed')).toBe('failed')
    expect(Model.statusOfListed('killed')).toBe('killed')
    expect(Model.statusOfListed('cancelled')).toBe('killed')
    expect(Model.statusOfListed('weird')).toBe('unknown')
  })
})
