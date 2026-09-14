import type { AgentInfo, CommandSpec, PaneCloseArgs, PaneOpenArgs, TimerCall } from 'claude-code'

/**
 * The engine as `session.start` bound it from its `$`, each member spelled
 * `$.noun.method(...)` there; used by every later hook, timer and press.
 */
export type Host = {
  /** `$.clock.now`. */
  now: () => Promise<number>
  /** `$.clock.after`. */
  after: TimerCall
  /** `$.clock.every`. */
  every: TimerCall
  /** `$.clock.sleep`, no signal. */
  sleep: (ms: number) => Promise<void>
  /** `$.agent.list`. */
  listAgents: () => Promise<AgentInfo[]>
  /** `$.store.get`. */
  storeGet: (key: string) => Promise<unknown>
  /** `$.store.set`. */
  storeSet: (key: string, value: unknown) => Promise<void>
  /** `$.ui.invalidate("ui.render")`: every pane instance draws again. */
  invalidate: () => void
  /** `$.ui.status`: the plugin's line under the prompt. */
  status: (text: string | undefined) => void
  /** `$.ui.log`: one line under the plugin's name. */
  uiLog: (text: string) => void
  /** `$.ui.open`. */
  openPane: (pane: PaneOpenArgs) => Promise<void>
  /** `$.ui.close`. */
  closePane: (pane: PaneCloseArgs) => Promise<void>
  /** `$.command.register`; rejects while another `/flow` is listed. */
  registerCommand: (spec: CommandSpec) => Promise<unknown>
}
