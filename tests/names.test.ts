import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Names from '../hooks/names'

tier('user')

describe('names and limits', () => {
  test('the pane, command and store names are the ones the spec fixes', () => {
    expect(Names.PANE_ID).toBe('agent-flow')
    expect(Names.PANE_TITLE).toBe('Agent flow')
    expect(Names.COMMAND_NAME).toBe('flow')
    expect(Names.STORE_OPEN_KEY).toBe('agent-flow.open')
    expect(Names.ROOT_ID).toBe('main')
    expect(Names.UNLISTED_KEY).toBe('unlisted')
  })

  test('the limits are the ones the spec fixes', () => {
    expect(Limits.OPEN_PROBE_MS).toBe(300)
    expect(Limits.RECONCILE_MS).toBe(2000)
    expect(Limits.TICK_MS).toBe(1000)
    expect(Limits.MAX_NODES).toBe(200)
    expect(Limits.AUTO_OPEN_MIN_COLUMNS).toBe(144)
    expect(Limits.KEPT_OPEN_MIN_COLUMNS).toBe(110)
  })
})
