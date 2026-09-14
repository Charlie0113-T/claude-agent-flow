import type { On, Timer } from 'claude-code'

import type { Host } from './host'
import Limits from './limits'
import Model from './model'
import Names from './names'
import PaneToggle from './pane-toggle'
import Views from './views'

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/**
 * Registers the agent flow pane: `/flow` once the command is granted, the
 * pane's drawing, the reducers behind every agent event, the reconcile and
 * tick timers while agents run, the auto-open on the first spawn, and the
 * text fallback where no surface draws the pane.
 *
 * `session.start` binds the host every later hook reads through; until it
 * has (or when `/flow` is refused because another plugin holds it) every
 * hook passes its event on untouched.
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
      noteFailure('agent.list', error, await engine.now().catch(() => 0))
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
      await engine.closePane({ id: Names.PANE_ID }).catch(() => undefined)
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
    const now = await engine.now()

    state = { ...Model.initialState(now), startedSurface: e.surface }

    try {
      await engine.registerCommand({ name: Names.COMMAND_NAME, description: Names.COMMAND_DESCRIPTION })
    } catch (error) {
      const reason = messageOf(error)

      if (!Names.BUILTIN_HOLDS_PATTERN.test(reason)) {
        engine.uiLog(`${Names.REGISTER_FAILED_TEXT}${reason}`)
      }

      return next(e)
    }

    host = engine
    storedOpen = await engine.storeGet(Names.STORE_OPEN_KEY).catch(() => undefined)
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
      noteFailure('ui.render', error, await $.clock.now().catch(() => 0))

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
        await engine.storeSet(Names.STORE_OPEN_KEY, false).catch(() => undefined)

        return {}
      }

      const isDrawn = await openPane(engine, true)

      if (!isDrawn) {
        return { text: textTreeOf(now) }
      }

      storedOpen = true
      await engine.storeSet(Names.STORE_OPEN_KEY, true).catch(() => undefined)

      return {}
    } catch (error) {
      return { text: `agent flow: ${messageOf(error)}` }
    }
  })

  on('ui.close', ($, e, next) => {
    try {
      if (e.id === Names.PANE_ID) {
        const isByPerson = e.origin.kind === 'person'

        state = Model.withPane(state, { isBelievedOpen: false, ...(isByPerson ? { closedByPerson: true } : {}) })

        if (isByPerson) {
          storedOpen = false
          void host?.storeSet(Names.STORE_OPEN_KEY, false).catch(() => undefined)
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
      noteFailure('agent.spawn', error, await engine.now().catch(() => 0))
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
