import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'

/**
 * Answers what an agent-flow session asks the engine beneath the plugin:
 * its start, each command it registers, an empty agent list, the store, and
 * the ui calls that draw nothing in a test. Returns the clock the session
 * reads, at 0 until the test moves it.
 *
 * @param on the test's `on`
 * @returns the mock clock
 */
export function answersEngine(on: On): MockClock {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('agent.list', () => ({ value: [] }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.close', ($, e, next) => next(e))
  mock.store(on)

  return mock.clock(on)
}
