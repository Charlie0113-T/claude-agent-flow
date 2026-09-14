import Limits from '../limits'
import type { FlowNode } from './flow-state'

export type Signal = 'waiting' | 'slow' | 'quiet' | 'none'

/**
 * What deserves attention about a node right now: it waits for the person,
 * its tool call runs long, or it runs but has gone silent.
 *
 * @param node the node
 * @param now the time
 * @returns the strongest signal, `none` when all is well
 */
export function signalOf(node: FlowNode, now: number): Signal {
  if (node.activity.kind === 'permission') {
    return 'waiting'
  }

  if (node.activity.kind === 'tool' && now - node.activity.since > Limits.SLOW_TOOL_MS) {
    return 'slow'
  }

  if (node.status === 'running' && node.activity.kind === 'idle' && now - node.lastEventAt > Limits.QUIET_MS) {
    return 'quiet'
  }

  return 'none'
}
