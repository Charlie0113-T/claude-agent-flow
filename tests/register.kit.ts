import { describe, expect, mock, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import Names from '../hooks/names'
import Fixtures from './fixtures'

tier('user')

const FLOW = { command: Names.COMMAND_NAME, args: '', origin: { kind: 'composer' as const } }
const SESSION = { surface: 'terminal' as const, isInteractive: true, cwd: '/work' }

describe('register', () => {
  test('/flow opens the pane; with no surface drawing it, the tree is printed instead', async ($, on) => {
    const opened: string[] = []
    const clock = Fixtures.answersEngine(on)

    on('ui.open', ($, e, next) => {
      opened.push(e.id)

      return next(e)
    })

    await $.session.start(SESSION)

    const ran = $.command.run(FLOW)

    await clock.settle()
    await clock.advance(Limits.OPEN_PROBE_MS)

    const { text } = await ran

    expect(opened).toEqual([Names.PANE_ID])
    expect(text).toContain('Agent flow · 0 agents')
    expect(text).toContain(Names.NO_AGENTS_TEXT)
  })

  test('/flow text prints the tree without opening anything', async ($, on) => {
    const opened: string[] = []

    Fixtures.answersEngine(on)
    on('ui.open', ($, e, next) => {
      opened.push(e.id)

      return next(e)
    })

    await $.session.start(SESSION)

    const { text } = await $.command.run({ ...FLOW, args: 'text' })

    expect(opened).toEqual([])
    expect(text).toContain('main · idle')
  })

  test('when another plugin holds /flow, this one stands down', async ($, on) => {
    const logged: string[] = []

    mock.clock(on)
    mock.store(on)
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ deny: 'a command named flow is registered already' }))
    on('command.run', () => ({ text: 'the other /flow ran' }))
    on('agent.list', () => ({ value: [] }))
    on('ui.invalidate', () => ({ value: undefined }))
    on('ui.status', () => ({ value: undefined }))

    on('ui.log', ($, e) => {
      logged.push(e.text)

      return { value: undefined }
    })

    await $.session.start(SESSION)

    expect(await $.command.run(FLOW)).toEqual({ text: 'the other /flow ran' })
    expect(logged).toEqual([`${Names.REGISTER_FAILED_TEXT}a command named flow is registered already`])
  })
})
