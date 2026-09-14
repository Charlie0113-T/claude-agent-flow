/** Consecutive reconciles a running node may miss from the list before it is gone. */
export const GONE_AFTER_MISSES = 2
/** The most nodes kept; finished ones are pruned beyond it. */
export const MAX_NODES = 200
/** Rows drawn when the pane sits inline above the prompt. */
export const INLINE_MAX_ROWS = 5
/** A description longer than this is cut with an ellipsis. */
export const DESCRIPTION_MAX_CHARS = 60
/** How much of a spawn prompt the node keeps. */
export const PROMPT_EXCERPT_CHARS = 120
/** How many recent tool calls a node keeps. */
export const RECENT_TOOLS = 5
/** How many events the ring buffer keeps. */
export const EVENT_LOG_SIZE = 50
