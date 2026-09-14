import Names from '../names'
import { ensureNode } from './ensure-node'
import type { FlowState } from './flow-state'
import { nodeOf, withEvent, withNode } from './flow-state'

/**
 * A permission request: the loop it came from waits for the person until its
 * next tool event or turn end clears it. A wait raised inside a running tool
 * call keeps that call's start, so the call's duration survives the wait.
 *
 * @param state the state
 * @param req the request, `agentId` absent for the main loop
 * @param now when it was raised
 * @returns the state
 */
export function onPermission(
  state: FlowState,
  req: { agentId?: string; tool?: string },
  now: number,
): FlowState {
  const id = req.agentId ?? Names.ROOT_ID
  const ensured = ensureNode(state, req.agentId, now)
  const node = nodeOf(ensured, id)

  if (node === undefined) {
    return ensured
  }

  return withEvent(
    withNode(ensured, {
      ...node,
      activity: { kind: 'permission', tool: req.tool, since: node.activity.kind === 'tool' ? node.activity.since : now },
      lastEventAt: now,
    }),
    {
      at: now,
      kind: 'permission',
      agentId: id,
      text: `waiting for approval${req.tool ? `: ${req.tool}` : ''}`,
    },
  )
}
