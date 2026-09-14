import Names from '../names'
import type { FlowState } from './flow-state'

export type Counts = { agents: number; running: number; waiting: number; unlisted: number }

/**
 * The header's numbers: every node but the root is an agent; running and
 * unlisted likewise exclude the root; waiting includes it, since the main
 * loop's permission prompt is the person's to answer too.
 *
 * @param state the state
 * @returns the counts
 */
export function countsOf(state: FlowState): Counts {
  const counts: Counts = { agents: 0, running: 0, waiting: 0, unlisted: 0 }

  for (const node of state.nodes.values()) {
    if (node.activity.kind === 'permission') {
      counts.waiting += 1
    }

    if (node.id === Names.ROOT_ID) {
      continue
    }

    counts.agents += 1
    counts.running += node.status === 'running' ? 1 : 0
    counts.unlisted += node.source === 'event' ? 1 : 0
  }

  return counts
}
