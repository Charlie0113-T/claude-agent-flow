import Limits from '../limits'
import { ensureNode } from './ensure-node'
import type { FlowState } from './flow-state'
import { nodeOf, withNode } from './flow-state'

export type TextPiece = { agentId?: string; text: string; startsBlock?: boolean }

/**
 * A piece of an agent's streamed reply: appended to the tail it keeps, cut
 * to the newest CHAT_TAIL_CHARS. A piece that opens a new text block (a new
 * step, or text after a tool call) starts a new line, since a block rarely
 * ends with one. The main loop's text is the transcript's own and is not kept.
 *
 * @param state the state
 * @param piece the text, the loop it came from (`agentId` absent for main),
 *   and whether it opens a new text block
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

  const tail = node.chatTail ?? ''
  const separator = piece.startsBlock === true && tail !== '' ? '\n' : ''

  return withNode(ensured, {
    ...node,
    chatTail: `${tail}${separator}${piece.text}`.slice(-Limits.CHAT_TAIL_CHARS),
    lastEventAt: now,
  })
}
