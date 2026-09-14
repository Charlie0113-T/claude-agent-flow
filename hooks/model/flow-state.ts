import type { RenderSurface } from 'claude-code'

import Limits from '../limits'
import Names from '../names'

export type NodeStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'killed'
  | 'aborted'
  | 'refusal'
  | 'gone'
  | 'unknown'

export type NodeSource = 'root' | 'spawn' | 'list' | 'event'

export type Activity =
  | { kind: 'idle' }
  | { kind: 'tool'; tool: string; since: number; toolUseId?: string }
  | { kind: 'permission'; tool?: string; since: number }

export type RecentTool = {
  tool: string
  startedAt: number
  durationMs?: number
  isError?: boolean
}

export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type FlowNode = {
  id: string
  parentId: string | null
  source: NodeSource
  type: string
  description: string
  name?: string
  model?: string
  background?: boolean
  fork?: boolean
  promptExcerpt?: string
  status: NodeStatus
  rawStatus?: string
  spawnedAt?: number
  firstSeenAt: number
  endedAt?: number
  lastEventAt: number
  activity: Activity
  toolCalls: number
  errors: number
  recentTools: readonly RecentTool[]
  turns: number
  usage: Usage
  misses: number
}

export type FlowEvent = { at: number; kind: string; agentId?: string; text: string }

export type PaneState = {
  isBelievedOpen: boolean
  wasDrawnSinceProbe: boolean
  columns: number | null
  placement: 'dock' | 'inline' | null
  expanded: ReadonlySet<string>
  hasAutoOpened: boolean
  closedByPerson: boolean
}

export type FlowState = {
  nodes: ReadonlyMap<string, FlowNode>
  events: readonly FlowEvent[]
  pane: PaneState
  startedSurface: RenderSurface | null
}

export type NodeSeed = Pick<FlowNode, 'id' | 'parentId' | 'source' | 'type' | 'description'> &
  Partial<FlowNode>

export const ZERO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

export const INITIAL_PANE: PaneState = {
  isBelievedOpen: false,
  wasDrawnSinceProbe: false,
  columns: null,
  placement: null,
  expanded: new Set<string>(),
  hasAutoOpened: false,
  closedByPerson: false,
}

const TERMINAL: readonly NodeStatus[] = ['completed', 'failed', 'killed', 'aborted', 'refusal', 'gone']

/**
 * Whether a status is an end state; `unknown` is neither running nor ended.
 *
 * @param status the node's status
 * @returns true for every end state
 */
export function isTerminal(status: NodeStatus): boolean {
  return TERMINAL.includes(status)
}

/**
 * A node from the facts a caller has, the rest defaulted: running, idle, no
 * calls, no usage.
 *
 * @param seed the identifying facts and any known field
 * @param now when it was first seen
 * @returns the node
 */
export function newNode(seed: NodeSeed, now: number): FlowNode {
  return {
    status: 'running',
    firstSeenAt: now,
    lastEventAt: now,
    activity: { kind: 'idle' },
    toolCalls: 0,
    errors: 0,
    recentTools: [],
    turns: 0,
    usage: ZERO_USAGE,
    misses: 0,
    ...seed,
  }
}

/**
 * The state at session start: the root node, idle, and nothing else.
 *
 * @param now the session's start time
 * @returns the state
 */
export function initialState(now: number): FlowState {
  const root = newNode(
    {
      id: Names.ROOT_ID,
      parentId: null,
      source: 'root',
      type: 'main',
      description: 'main conversation',
      status: 'completed',
    },
    now,
  )

  return {
    nodes: new Map([[root.id, root]]),
    events: [],
    pane: INITIAL_PANE,
    startedSurface: null,
  }
}

export function nodeOf(state: FlowState, id: string): FlowNode | undefined {
  return state.nodes.get(id)
}

export function withNode(state: FlowState, node: FlowNode): FlowState {
  const nodes = new Map(state.nodes)

  nodes.set(node.id, node)

  return { ...state, nodes }
}

export function withEvent(state: FlowState, event: FlowEvent): FlowState {
  const events = [...state.events, event].slice(-Limits.EVENT_LOG_SIZE)

  return { ...state, events }
}

export function withPane(state: FlowState, patch: Partial<PaneState>): FlowState {
  return { ...state, pane: { ...state.pane, ...patch } }
}
