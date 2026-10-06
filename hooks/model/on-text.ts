import Limits from '../limits'
import { ensureNode } from './ensure-node'
import type { FlowState } from './flow-state'
import { nodeOf, withNode } from './flow-state'

export type TextPiece = { agentId?: string; text: string }

/**
 * A piece of an agent's streamed reply: appended to the tail it keeps, cut
 * to the newest CHAT_TAIL_CHARS. The main loop's text is the transcript's own
 * and is not kept.
 *
 * @param state the state
 * @param piece the text and the loop it came from, `agentId` absent for main
 * @param now when it arrived
 * @returns the state
 */
export function onText(state: FlowState, piece: TextPiece, now: number): FlowState {
  if (piece.agentId === undefined || piece.text === '') {
    return state
  }

  const ensured = ensureNode(state, piece.agentId, now)
  const node = nodeOf(ensured, piece.agentId)

  if (node === undefined) {
    return ensured
  }

  return withNode(ensured, {
    ...node,
    chatTail: `${node.chatTail ?? ''}${piece.text}`.slice(-Limits.CHAT_TAIL_CHARS),
    lastEventAt: now,
  })
}
