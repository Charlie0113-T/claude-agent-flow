import Limits from '../limits'
import Names from '../names'
import { ensureNode } from './ensure-node'
import type { FlowState, RecentTool } from './flow-state'
import { isTerminal, nodeOf, withEvent, withNode } from './flow-state'

export type ToolStart = { agentId?: string; tool: string; toolUseId?: string }
export type ToolEnd = { agentId?: string; tool: string; isError: boolean }

/**
 * A tool call begins: the loop it runs in is busy in that tool from now. A
 * finished subagent that calls a tool is running again (SendMessage woke it).
 *
 * @param state the state
 * @param call the call, `agentId` absent for the main loop
 * @param now when it began
 * @returns the state
 */
export function onToolStart(state: FlowState, call: ToolStart, now: number): FlowState {
  const id = call.agentId ?? Names.ROOT_ID
  const ensured = ensureNode(state, call.agentId, now)
  const node = nodeOf(ensured, id)

  if (node === undefined) {
    return ensured
  }

  const isWoken = id !== Names.ROOT_ID && isTerminal(node.status)

  return withEvent(
    withNode(ensured, {
      ...node,
      activity: { kind: 'tool', tool: call.tool, since: now, toolUseId: call.toolUseId },
      status: isWoken ? 'running' : node.status,
      endedAt: isWoken ? undefined : node.endedAt,
      lastEventAt: now,
    }),
    { at: now, kind: 'tool.call', agentId: id, text: `${call.tool} started` },
  )
}

/**
 * A tool call ends: the loop is idle again, the call is counted and kept
 * among the recent ones with its duration and outcome.
 *
 * @param state the state
 * @param call the call, `agentId` absent for the main loop
 * @param now when it ended
 * @returns the state
 */
export function onToolEnd(state: FlowState, call: ToolEnd, now: number): FlowState {
  const id = call.agentId ?? Names.ROOT_ID
  const node = nodeOf(state, id)

  if (node === undefined) {
    return state
  }

  const startedAt = node.activity.kind === 'tool' ? node.activity.since : now
  const recent: RecentTool = { tool: call.tool, startedAt, durationMs: now - startedAt, isError: call.isError }

  return withEvent(
    withNode(state, {
      ...node,
      activity: { kind: 'idle' },
      toolCalls: node.toolCalls + 1,
      errors: node.errors + (call.isError ? 1 : 0),
      recentTools: [...node.recentTools, recent].slice(-Limits.RECENT_TOOLS),
      lastEventAt: now,
    }),
    { at: now, kind: 'tool.call', agentId: id, text: `${call.tool} ${call.isError ? 'failed' : 'done'} ${now - startedAt}ms` },
  )
}
