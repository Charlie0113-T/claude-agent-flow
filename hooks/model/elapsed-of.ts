import type { FlowNode } from './flow-state'

/**
 * A duration as the pane prints it: whole seconds below a minute, `m` and
 * two-digit seconds above.
 *
 * @param ms the duration in milliseconds
 * @returns the text
 */
export function durationTextOf(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))

  if (seconds < 60) {
    return `${seconds}s`
  }

  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}

/**
 * How long a node has run: from its spawn (or its first sight, marked `~` as
 * a lower bound) to its end or now.
 *
 * @param node the node
 * @param now the time
 * @returns the text
 */
export function elapsedOf(node: FlowNode, now: number): string {
  const from = node.spawnedAt ?? node.firstSeenAt
  const text = durationTextOf((node.endedAt ?? now) - from)

  return node.spawnedAt === undefined ? `~${text}` : text
}
