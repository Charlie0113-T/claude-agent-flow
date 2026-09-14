import Limits from '../limits'
import Names from '../names'
import type { FlowNode, FlowState, NodeStatus } from './flow-state'
import { isTerminal, newNode, withEvent } from './flow-state'
import { prune } from './prune'

/**
 * One agent as `$.agent.list()` describes it (structurally an AgentInfo).
 */
export type Listed = {
  id: string
  description: string
  type: string
  status: string
  parentId?: string
  name?: string
}

/**
 * Maps the engine's task status words onto node statuses.
 *
 * @param raw the list's status string
 * @returns the status; `unknown` for a word this mod does not know
 */
export function statusOfListed(raw: string): NodeStatus {
  switch (raw) {
    case 'running':
    case 'pending':
    case 'in_progress':
      return 'running'
    case 'completed':
    case 'done':
    case 'success':
      return 'completed'
    case 'failed':
    case 'error':
      return 'failed'
    case 'killed':
    case 'cancelled':
    case 'stopped':
      return 'killed'
    default:
      return 'unknown'
  }
}

/**
 * Merges what the engine lists into the tree: the list has the last word on
 * status and fills a parent the events never gave; a running spawn- or
 * list-sourced node absent from GONE_AFTER_MISSES lists in a row is gone.
 * Root and event-sourced nodes are never judged absent.
 *
 * @param state the state
 * @param listed the agents `$.agent.list()` answered
 * @param now when the list was read
 * @returns the state
 */
export function reconcile(state: FlowState, listed: readonly Listed[], now: number): FlowState {
  const nodes = new Map(state.nodes)
  const seen = new Set<string>()
  let next: FlowState = { ...state, nodes }

  for (const info of listed) {
    seen.add(info.id)

    const mapped = statusOfListed(info.status)
    const rawStatus = mapped === 'unknown' ? info.status : undefined
    const existing = nodes.get(info.id)

    if (existing === undefined) {
      nodes.set(
        info.id,
        newNode(
          {
            id: info.id,
            parentId: info.parentId ?? null,
            source: 'list',
            type: info.type,
            description: info.description,
            name: info.name,
            status: mapped,
            rawStatus,
            endedAt: isTerminal(mapped) ? now : undefined,
          },
          now,
        ),
      )
      continue
    }

    const isPlaceholder = existing.source === 'event'
    const merged: FlowNode = {
      ...existing,
      source: isPlaceholder ? 'list' : existing.source,
      type: isPlaceholder ? info.type : existing.type,
      description: isPlaceholder ? info.description : existing.description,
      name: existing.name ?? info.name,
      parentId: existing.parentId ?? info.parentId ?? null,
      status: mapped,
      rawStatus,
      endedAt: isTerminal(mapped) ? (existing.endedAt ?? now) : undefined,
      lastEventAt: mapped === existing.status ? existing.lastEventAt : now,
      misses: 0,
    }

    nodes.set(info.id, merged)
  }

  for (const node of [...nodes.values()]) {
    const isJudged =
      node.id !== Names.ROOT_ID && node.source !== 'event' && !seen.has(node.id) && node.status === 'running'

    if (!isJudged) {
      continue
    }

    const misses = node.misses + 1

    if (misses < Limits.GONE_AFTER_MISSES) {
      nodes.set(node.id, { ...node, misses })
      continue
    }

    nodes.set(node.id, {
      ...node,
      misses,
      status: 'gone',
      endedAt: now,
      activity: { kind: 'idle' },
      lastEventAt: now,
    })
    next = withEvent(next, { at: now, kind: 'gone', agentId: node.id, text: `${node.type} left the list` })
  }

  return prune({ ...next, nodes })
}
