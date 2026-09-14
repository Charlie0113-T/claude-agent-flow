import Names from '../names'
import { ensureNode } from './ensure-node'
import type { FlowState, NodeStatus } from './flow-state'
import { nodeOf, withEvent, withNode } from './flow-state'

export type TurnTokens = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export type TurnComplete = { agentId?: string; reason: string; durationMs: number; usage?: TurnTokens }

/**
 * Maps `turn.complete`'s reason to a node status.
 *
 * @param reason `answer`, `error`, `aborted` or `refusal`
 * @returns the status; `unknown` for anything else
 */
export function statusOfReason(reason: string): NodeStatus {
  switch (reason) {
    case 'answer':
      return 'completed'
    case 'error':
      return 'failed'
    case 'aborted':
      return 'aborted'
    case 'refusal':
      return 'refusal'
    default:
      return 'unknown'
  }
}

/**
 * The main loop starts a turn: the root is busy.
 *
 * @param state the state
 * @param now when the turn started
 * @returns the state
 */
export function onTurnStart(state: FlowState, now: number): FlowState {
  const root = nodeOf(state, Names.ROOT_ID)

  if (root === undefined) {
    return state
  }

  return withNode(state, { ...root, status: 'running', lastEventAt: now })
}

/**
 * A turn ends: a subagent's node takes the reason's status and its end time;
 * the root goes idle. Either sums the turn's tokens and counts the turn.
 *
 * @param state the state
 * @param turn the turn, `agentId` absent for the main loop
 * @param now when it ended
 * @returns the state
 */
export function onTurnComplete(state: FlowState, turn: TurnComplete, now: number): FlowState {
  const id = turn.agentId ?? Names.ROOT_ID
  const ensured = ensureNode(state, turn.agentId, now)
  const node = nodeOf(ensured, id)

  if (node === undefined) {
    return ensured
  }

  const isRoot = id === Names.ROOT_ID
  const status: NodeStatus = isRoot ? 'completed' : statusOfReason(turn.reason)
  const usage = turn.usage
    ? {
        input: node.usage.input + turn.usage.input_tokens,
        output: node.usage.output + turn.usage.output_tokens,
        cacheRead: node.usage.cacheRead + turn.usage.cache_read_input_tokens,
        cacheWrite: node.usage.cacheWrite + turn.usage.cache_creation_input_tokens,
      }
    : node.usage

  return withEvent(
    withNode(ensured, {
      ...node,
      status,
      endedAt: isRoot ? node.endedAt : now,
      turns: node.turns + 1,
      usage,
      activity: { kind: 'idle' },
      lastEventAt: now,
    }),
    { at: now, kind: 'turn.complete', agentId: id, text: `${turn.reason} ${turn.durationMs}ms` },
  )
}
