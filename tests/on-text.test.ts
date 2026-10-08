import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Model from '../hooks/model'
import Fixtures from './fixtures'

tier('user')

describe('on-text', () => {
  test('a subagent\'s text pieces accumulate and the tail is bounded', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)

    state = Model.onText(state, { agentId: 'a', text: 'hello ' }, 5)
    state = Model.onText(state, { agentId: 'a', text: 'world' }, 6)

    expect(Model.nodeOf(state, 'a')?.chatTail).toBe('hello world')
    expect(Model.nodeOf(state, 'a')?.lastEventAt).toBe(6)

    state = Model.onText(state, { agentId: 'a', text: 'x'.repeat(Limits.CHAT_TAIL_CHARS) }, 7)

    expect(Model.nodeOf(state, 'a')?.chatTail?.length).toBe(Limits.CHAT_TAIL_CHARS)
  })

  test('the main loop\'s text is not kept', () => {
    const state = Model.initialState(0)

    expect(Model.onText(state, { text: 'hi' }, 1)).toBe(state)
  })

  test('a new text block starts a new line, so one step\'s text does not run into the next', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)

    state = Model.onText(state, { agentId: 'a', text: 'I\'ll list the files.', startsBlock: true }, 2)
    state = Model.onText(state, { agentId: 'a', text: 'Now reading ', startsBlock: true }, 3)
    state = Model.onText(state, { agentId: 'a', text: 'the config.' }, 4)
    const node = Model.nodeOf(state, 'a')

    expect(node?.chatTail).toBe('I\'ll list the files.\nNow reading the config.')
    expect(node && Model.detailsOf(node).filter(line => line.startsWith('says '))).toEqual([
      'says I\'ll list the files.',
      'says Now reading the config.',
    ])
  })

  test('an expanded node shows the last lines it wrote', () => {
    let state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)

    state = Model.onText(state, { agentId: 'a', text: 'one\ntwo\nthree\nfour' }, 2)
    const node = Model.nodeOf(state, 'a')

    expect(node && Model.detailsOf(node).filter(line => line.startsWith('says '))).toEqual([
      'says one',
      'says two',
      'says three',
      'says four',
    ])
  })
})
