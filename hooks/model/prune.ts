import Limits from '../limits'
import type { FlowNode, FlowState } from './flow-state'
import { isTerminal } from './flow-state'

/**
 * Keeps the tree under MAX_NODES by dropping finished leaves, oldest ended
 * first, one at a time until it fits or no finished leaf remains. Running
 * nodes and nodes with children are never dropped.
 *
 * @param state the state
 * @returns the state, pruned
 */
export function prune(state: FlowState): FlowState {
  if (state.nodes.size <= Limits.MAX_NODES) {
    return state
  }

  const nodes = new Map(state.nodes)

  while (nodes.size > Limits.MAX_NODES) {
    const parents = new Set([...nodes.values()].map(node => node.parentId))
    const leaves = [...nodes.values()].filter(
      (node: FlowNode) => node.source !== 'root' && isTerminal(node.status) && !parents.has(node.id),
    )

    if (leaves.length === 0) {
      break
    }

    leaves.sort((a, b) => (a.endedAt ?? a.firstSeenAt) - (b.endedAt ?? b.firstSeenAt))
    nodes.delete((leaves[0] as FlowNode).id)
  }

  return { ...state, nodes }
}
