import type { On, Timer } from 'claude-code'

import type { Host } from './host'
import Limits from './limits'
import Model from './model'
import Names from './names'
import PaneToggle from './pane-toggle'
import Views from './views'

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/**
 * Runs an engine call that must not fail the caller: its rejection or throw
 * answers `fallback`. Engine calls are awaited, never chained with .catch,
 * because the live engine's answers are awaitable but not Promises.
 */
async function quietly<T>(work: () => PromiseLike<T> | T, fallback: T): Promise<T> {
  try {
    return await work()
  } catch {
    return fallback
  }
}

/**
 * Registers the agent flow pane: `/flow` once the command is granted, the
 * pane's drawing, the reducers behind every agent event, the reconcile and
 * tick timers while agents run, the auto-open on the first spawn, the reset
 * on `/clear` and `/resume`, and the text fallback where no surface draws
 * the pane.
 *
 * `session.start` binds the host every later hook reads through; until it
 * has (registration refused for any reason, said once over `$.ui.log`)
 * every hook passes its event on untouched.
 *
 * @param on the engine's registrar
 */
export function register(on: On) {
  let host: Host | null = null
  let state: Model.FlowState = Model.initialState(0)
  let storedOpen: unknown = undefined
  let lastStatus: string | undefined = undefined
  let redrawTimer: Timer | null = null
  const timers = new Map<'reconcile' | 'tick', Timer>()

  function isAnythingRunning(): boolean {
    return Model.countsOf(state).running > 0
  }

  function redraw(): void {
    const engine = host

    if (engine === null || redrawTimer !== null) {
      return
    }

    redrawTimer = engine.after(Limits.INVALIDATE_DEBOUNCE_MS, () => {
      redrawTimer = null
      engine.invalidate()
    })
  }

  function syncTimers(): void {
    const engine = host

    if (engine === null) {
      return
    }

    const isWanted = isAnythingRunning()

    if (isWanted && !timers.has('reconcile')) {
      timers.set(
        'reconcile',
        engine.every(Limits.RECONCILE_MS, () => {
          void reconcileNow()
        }),
      )
      timers.set(
        'tick',
        engine.every(Limits.TICK_MS, () => {
          if (state.pane.isBelievedOpen) {
            engine.invalidate()
          }
        }),
      )
    }

    if (!isWanted && timers.size > 0) {
      for (const timer of timers.values()) {
        timer.cancel()
      }

      timers.clear()
    }
  }

  function syncStatus(): void {
    const engine = host

    if (engine === null) {
      return
    }

    const waiting = Model.countsOf(state).waiting
    const text =
      !state.pane.isBelievedOpen && waiting > 0
        ? `${waiting} agent${waiting === 1 ? '' : 's'} waiting for approval`
        : undefined

    if (text !== lastStatus) {
      lastStatus = text
      engine.status(text)
    }
  }

  function apply(reduce: (current: Model.FlowState) => Model.FlowState): void {
    state = reduce(state)
    syncTimers()
    syncStatus()
    redraw()
  }

  function noteFailure(kind: string, error: unknown, at: number): void {
    state = Model.withEvent(state, { at, kind, text: `failed: ${messageOf(error)}` })
  }

  async function reconcileNow(): Promise<void> {
    const engine = host

    if (engine === null) {
      return
    }

    try {
      const listed = await engine.listAgents()
      const now = await engine.now()

      apply(current => Model.reconcile(current, listed, now))
    } catch (error) {
      noteFailure('agent.list', error, await quietly(() => engine.now(), 0))
    }
  }

  async function probeDrawn(engine: Host): Promise<boolean> {
    state = Model.withPane(state, { wasDrawnSinceProbe: false })
    engine.invalidate()
    await engine.sleep(Limits.OPEN_PROBE_MS)

    return state.pane.wasDrawnSinceProbe
  }

  async function openPane(engine: Host, isFocused: boolean): Promise<boolean> {
    await engine.openPane({
      id: Names.PANE_ID,
      title: Names.PANE_TITLE,
      ...(isFocused ? { focus: true as const } : {}),
    })
    state = Model.withPane(state, { isBelievedOpen: true })

    const isDrawn = await probeDrawn(engine)

    if (!isDrawn) {
      await quietly(() => engine.closePane({ id: Names.PANE_ID }), undefined)
      state = Model.withPane(state, { isBelievedOpen: false })
    }

    syncStatus()

    return isDrawn
  }

  async function closePane(engine: Host): Promise<void> {
    await engine.closePane({ id: Names.PANE_ID })
    state = Model.withPane(state, { isBelievedOpen: false })
    syncStatus()
  }

  function toggleExpanded(id: string): void {
    const expanded = new Set(state.pane.expanded)

    if (expanded.has(id)) {
      expanded.delete(id)
    } else {
      expanded.add(id)
    }

    state = Model.withPane(state, { expanded })
    redraw()
  }

  function textTreeOf(now: number): string {
    return Views.textView(Model.rowsOf(state, now, state.pane.expanded))
  }

  async function maybeAutoOpen(engine: Host): Promise<void> {
    const isWanted = PaneToggle.shouldAutoOpen({
      startedSurface: state.startedSurface,
      hasAutoOpened: state.pane.hasAutoOpened,
      closedByPerson: state.pane.closedByPerson,
      storedOpen,
      columns: state.pane.columns,
    })

    if (!isWanted || state.pane.isBelievedOpen) {
      return
    }

    state = Model.withPane(state, { hasAutoOpened: true })
    await openPane(engine, false)
  }

  on('session.start', async ($, e, next) => {
    const engine: Host = {
      now: () => $.clock.now(),
      after: (ms, fn) => $.clock.after(ms, fn),
      every: (ms, fn) => $.clock.every(ms, fn),
      sleep: ms => $.clock.sleep(ms),
      listAgents: () => $.agent.list(),
      storeGet: key => $.store.get(key),
      storeSet: (key, value) => $.store.set(key, value),
      invalidate: () => $.ui.invalidate('ui.render'),
      status: text => $.ui.status(text),
      uiLog: text => $.ui.log(text),
      openPane: pane => $.ui.open(pane),
      closePane: pane => $.ui.close(pane),
      registerCommand: spec => $.command.register(spec),
    }
    const now = await quietly(() => engine.now(), 0)

    state = { ...Model.initialState(now), startedSurface: e.surface }

    try {
      await engine.registerCommand({ name: Names.COMMAND_NAME, description: Names.COMMAND_DESCRIPTION })
    } catch (error) {
      engine.uiLog(`${Names.REGISTER_FAILED_TEXT}${messageOf(error)}`)

      return next(e)
    }

    host = engine
    storedOpen = await quietly(() => engine.storeGet(Names.STORE_OPEN_KEY), undefined)
    await reconcileNow()

    return next(e)
  })

  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    const columns = e.viewport?.columns

    if (columns !== undefined && columns !== state.pane.columns) {
      state = Model.withPane(state, { columns })
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== Names.PANE_ID || host === null) {
      return next(e)
    }

    try {
      const { Box, Text, Button } = await $.ui.resolve(e)
      const now = await $.clock.now()

      state = Model.withPane(state, {
        wasDrawnSinceProbe: true,
        columns: e.viewport?.columns ?? state.pane.columns,
        placement: e.props.placement,
      })

      const rows =
        e.props.placement === 'inline'
          ? Model.inlineRowsOf(state, now)
          : Model.rowsOf(state, now, state.pane.expanded)

      return Views.paneView({ Box, Text, Button }, rows, { onToggle: toggleExpanded })
    } catch (error) {
      noteFailure('ui.render', error, await quietly(() => $.clock.now(), 0))

      return next(e)
    }
  })

  on('command.run', { command: Names.COMMAND_NAME }, async ($, e, next) => {
    const engine = host

    if (engine === null) {
      return next(e)
    }

    try {
      const now = await engine.now()
      const args = e.args.trim()

      if (args === 'text') {
        return { text: textTreeOf(now) }
      }

      if (args !== '') {
        return { text: Names.USAGE_TEXT }
      }

      const wasDrawnWhenProbed = state.pane.isBelievedOpen && (await probeDrawn(engine))
      const toggle = PaneToggle.paneToggleOf({ isBelievedOpen: state.pane.isBelievedOpen, wasDrawnWhenProbed })

      if (toggle === 'close') {
        await closePane(engine)
        storedOpen = false
        await quietly(() => engine.storeSet(Names.STORE_OPEN_KEY, false), undefined)

        return {}
      }

      let isDrawn: boolean

      try {
        isDrawn = await openPane(engine, true)
      } catch (error) {
        noteFailure('ui.open', error, now)

        return { text: textTreeOf(now) }
      }

      if (!isDrawn) {
        return { text: textTreeOf(now) }
      }

      storedOpen = true
      await quietly(() => engine.storeSet(Names.STORE_OPEN_KEY, true), undefined)

      return {}
    } catch (error) {
      return { text: `agent flow: ${messageOf(error)}` }
    }
  })

  on('command.run', { command: ['clear', 'resume'] }, async ($, e, next) => {
    const engine = host

    if (engine !== null) {
      try {
        const now = await engine.now()

        apply(current => Model.resetSession(current, now))
      } catch (error) {
        noteFailure('command.run', error, 0)
      }
    }

    return next(e)
  })

  on('ui.close', ($, e, next) => {
    try {
      if (e.id === Names.PANE_ID) {
        const isByPerson = e.origin.kind === 'person'

        state = Model.withPane(state, { isBelievedOpen: false, ...(isByPerson ? { closedByPerson: true } : {}) })

        if (isByPerson) {
          storedOpen = false

          const engine = host

          if (engine !== null) {
            void quietly(() => engine.storeSet(Names.STORE_OPEN_KEY, false), undefined)
          }
        }

        syncStatus()
      }
    } catch (error) {
      noteFailure('ui.close', error, 0)
    }

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    const engine = host

    if (engine === null) {
      return result
    }

    try {
      const now = await engine.now()

      apply(current =>
        Model.onSpawn(
          current,
          {
            agentId: result.agentId,
            deny: result.deny,
            parentAgentId: e.parentAgentId,
            subagentType: e.subagentType,
            description: e.description,
            model: result.model,
            name: e.name,
            background: e.background,
            fork: e.fork,
            prompt: e.prompt,
          },
          now,
        ),
      )
      await maybeAutoOpen(engine)
    } catch (error) {
      noteFailure('agent.spawn', error, await quietly(() => engine.now(), 0))
    }

    return result
  })

  on('tool.call', async ($, e, next) => {
    const engine = host

    if (engine !== null) {
      try {
        const now = await engine.now()

        apply(current => Model.onToolStart(current, { agentId: e.agentId, tool: e.tool, toolUseId: e.tool_use_id }, now))
      } catch (error) {
        noteFailure('tool.call', error, 0)
      }
    }

    const result = await next(e)

    if (engine !== null) {
      try {
        const now = await engine.now()
        const isError = 'isError' in result && result.isError === true

        apply(current => Model.onToolEnd(current, { agentId: e.agentId, tool: e.tool, isError }, now))
      } catch (error) {
        noteFailure('tool.call', error, 0)
      }
    }

    return result
  })

  on('turn.start', async ($, e, next) => {
    const engine = host

    if (engine !== null) {
      try {
        const now = await engine.now()

        apply(current => Model.onTurnStart(current, now))
      } catch (error) {
        noteFailure('turn.start', error, 0)
      }
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const engine = host

    if (engine !== null) {
      try {
        const now = await engine.now()

        apply(current =>
          Model.onTurnComplete(
            current,
            { agentId: e.agentId, reason: e.reason, durationMs: e.durationMs, usage: e.usage },
            now,
          ),
        )
      } catch (error) {
        noteFailure('turn.complete', error, 0)
      }
    }

    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const engine = host

    if (engine !== null) {
      try {
        const now = await engine.now()

        apply(current => Model.onPermission(current, { agentId: e.agent_id, tool: e.tool_name }, now))
      } catch (error) {
        noteFailure('permission', error, 0)
      }
    }

    return next(e)
  })

  on('classic.Notification', { notification_type: 'permission_prompt' }, async ($, e, next) => {
    const engine = host

    if (engine !== null) {
      try {
        const now = await engine.now()

        apply(current => Model.onPermission(current, { agentId: e.agent_id }, now))
      } catch (error) {
        noteFailure('permission', error, 0)
      }
    }

    return next(e)
  })
}
