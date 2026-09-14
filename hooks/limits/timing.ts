/** How long an open pane gets to draw before its surface is judged unable to. */
export const OPEN_PROBE_MS = 300
/** How often `$.agent.list()` corrects the tree while anything runs. */
export const RECONCILE_MS = 2000
/** How often the pane redraws to refresh elapsed times while anything runs. */
export const TICK_MS = 1000
/** How long state changes gather before one `$.ui.invalidate`. */
export const INVALIDATE_DEBOUNCE_MS = 100
/** A tool call longer than this is flagged slow. */
export const SLOW_TOOL_MS = 30000
/** A running agent with no event for this long is flagged quiet. */
export const QUIET_MS = 120000
