import type { FlowState } from './flow-state'
import { newNode, nodeOf, withNode } from './flow-state'

/**
 * Makes sure an agent id has a node: an id no spawn and no list named gets
 * an event-sourced placeholder under the "unlisted loops" group.
 *
 * @param state the state
 * @param agentId the loop an event named, or undefined for the main loop
 * @param now when the event arrived
 * @returns the same state when nothing was missing
 */
export function ensureNode(state: FlowState, agentId: string | undefined, now: number): FlowState {
  if (agentId === undefined || nodeOf(state, agentId) !== undefined) {
    return state
  }

  return withNode(
    state,
    newNode(
      {
        id: agentId,
        parentId: null,
        source: 'event',
        type: 'loop',
        description: agentId.slice(0, 8),
      },
      now,
    ),
  )
}
