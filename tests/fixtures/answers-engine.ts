import type { On } from 'claude-code'
import type { MockClock } from 'claude-code/testing'
// A namespace import, not `import { mock }`: the real kit (`bun/kit.ts`) is
// augmented with `mock`'s type by the ambient `claude-code/testing` d.ts (so
// tsc sees it), but does not yet export it at runtime — only `describe`,
// `expect`, `test`, `tier` do. A named import is a static binding Bun's
// linker checks against the real file and would throw for every test that
// reaches this fixture through the `fixtures` barrel; a namespace import
// defers the property access to call time, which never happens under
// `bun test` since only `register.kit.ts` calls `answersEngine`.
import * as testing from 'claude-code/testing'

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
  testing.mock.store(on)

  return testing.mock.clock(on)
}
