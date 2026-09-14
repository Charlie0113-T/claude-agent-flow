import Limits from '../limits'
import Names from '../names'
import { countsOf } from './counts-of'
import { durationTextOf, elapsedOf } from './elapsed-of'
import type { FlowNode, FlowState } from './flow-state'
import { isTerminal, nodeOf } from './flow-state'
import type { Signal } from './signal-of'
import { signalOf } from './signal-of'
import { tokensTextOf } from './tokens-text-of'

export type RowKind = 'header' | 'root' | 'node' | 'group' | 'detail' | 'event' | 'hint' | 'empty'

/**
 * One line of the pane or of the text tree: what it says and how it is
 * styled; `id` on the expandable rows (a node, the unlisted group).
 */
export type Row = {
  kind: RowKind
  text: string
  id?: string
  color?: string
  dim?: boolean
  bold?: boolean
  isExpanded?: boolean
}

const MAX_DEPTH = 8

export function headerTextOf(state: FlowState): string {
  const counts = countsOf(state)
  const unlisted = counts.unlisted > 0 ? ` · ${counts.unlisted} unlisted` : ''

  return `Agent flow · ${counts.agents} agents · ${counts.running} running · ${counts.waiting} waiting${unlisted}`
}

function activityTextOf(node: FlowNode, now: number, signal: Signal): string {
  switch (node.activity.kind) {
    case 'tool':
      return `${node.activity.tool} ${durationTextOf(now - node.activity.since)}${signal === 'slow' ? ' !' : ''}`
    case 'permission':
      return `waiting for approval${node.activity.tool ? `: ${node.activity.tool}` : ''}`
    default:
      return signal === 'quiet' ? `quiet ${Math.floor((now - node.lastEventAt) / 60000)}m` : ''
  }
}

function glyphOf(node: FlowNode, signal: Signal): string {
  if (signal === 'waiting') {
    return '◐'
  }

  switch (node.status) {
    case 'running':
      return '●'
    case 'completed':
      return '✓'
    case 'unknown':
      return '○'
    default:
      return '✗'
  }
}

function colorOf(node: FlowNode, signal: Signal): string | undefined {
  if (signal === 'waiting') {
    return 'magenta'
  }

  if (signal === 'slow') {
    return 'yellow'
  }

  if (signal === 'quiet') {
    return 'gray'
  }

  switch (node.status) {
    case 'running':
      return 'yellow'
    case 'completed':
      return 'green'
    case 'unknown':
      return undefined
    default:
      return 'red'
  }
}

function tagOf(node: FlowNode): string {
  if (node.status === 'unknown') {
    return node.rawStatus ? `[${node.rawStatus}]` : '[unknown]'
  }

  return isTerminal(node.status) && node.status !== 'completed' ? `[${node.status}]` : ''
}

function cut(text: string): string {
  return text.length > Limits.DESCRIPTION_MAX_CHARS ? `${text.slice(0, Limits.DESCRIPTION_MAX_CHARS - 1)}…` : text
}

/**
 * A node's line: prefix, glyph, type, name, description, elapsed, then its
 * activity, call count, tokens and status tag where each applies.
 *
 * @param node the node
 * @param now the time
 * @param prefix the tree prefix (`├─ `, `│  └─ `), or empty inline
 * @returns the text
 */
export function nodeTextOf(node: FlowNode, now: number, prefix: string): string {
  const signal = signalOf(node, now)
  const name = node.name ? ` ${node.name}` : ''
  const base = `${prefix}${glyphOf(node, signal)} ${node.type}${name} "${cut(node.description)}" ${elapsedOf(node, now)}`
  const activity = activityTextOf(node, now, signal)
  const calls = isTerminal(node.status) || node.toolCalls > 0 ? ` ×${node.toolCalls}` : ''
  const tokens = isTerminal(node.status) ? tokensTextOf(node.usage) : ''
  const tag = tagOf(node)

  return (
    base +
    (activity ? ` · ${activity}` : '') +
    (activity && node.activity.kind === 'tool' ? '' : calls) +
    (tokens ? ` · ${tokens}` : '') +
    (tag ? ` ${tag}` : '')
  )
}

/**
 * The lines under an expanded node: model and mode, prompt excerpt, recent
 * tool calls, tokens, id.
 *
 * @param node the node
 * @returns the lines, unindented
 */
export function detailsOf(node: FlowNode): string[] {
  const mode = node.fork ? 'fork' : node.background ? 'background' : 'foreground'
  const tools =
    node.recentTools.length === 0
      ? ['no tool calls yet']
      : node.recentTools.map(
          call => `${call.tool} ${durationTextOf(call.durationMs ?? 0)}${call.isError ? ' ✗' : ''}`,
        )

  return [
    `model ${node.model ?? '?'} · ${mode}`,
    ...(node.promptExcerpt ? [`prompt ${node.promptExcerpt}`] : []),
    ...tools,
    `tokens in ${node.usage.input} out ${node.usage.output} cache ${node.usage.cacheRead}/${node.usage.cacheWrite}`,
    `id ${node.id}`,
  ]
}

function nodeRowOf(node: FlowNode, now: number, prefix: string, expanded: ReadonlySet<string>): Row {
  const signal = signalOf(node, now)
  const isDim = isTerminal(node.status) && signal === 'none'

  return {
    kind: 'node',
    id: node.id,
    text: nodeTextOf(node, now, prefix),
    color: colorOf(node, signal),
    ...(isDim ? { dim: true } : {}),
    ...(signal === 'waiting' ? { bold: true } : {}),
    isExpanded: expanded.has(node.id),
  }
}

function byFirstSeen(a: FlowNode, b: FlowNode): number {
  return a.firstSeenAt - b.firstSeenAt
}

function treeRowsOf(
  nodes: readonly FlowNode[],
  now: number,
  expanded: ReadonlySet<string>,
  indent: string,
): Row[] {
  const known = new Set(nodes.map(node => node.id))
  const rows: Row[] = []

  const childrenOf = (parentId: string | null): FlowNode[] =>
    nodes
      .filter(node =>
        parentId === null ? node.parentId === null || !known.has(node.parentId) : node.parentId === parentId,
      )
      .sort(byFirstSeen)

  const walk = (parentId: string | null, prefix: string, depth: number): void => {
    if (depth > MAX_DEPTH) {
      return
    }

    const list = childrenOf(parentId)

    list.forEach((node, index) => {
      const isLast = index === list.length - 1

      rows.push(nodeRowOf(node, now, `${prefix}${isLast ? '└─ ' : '├─ '}`, expanded))

      const under = `${prefix}${isLast ? '   ' : '│  '}`

      if (expanded.has(node.id)) {
        for (const line of detailsOf(node)) {
          rows.push({ kind: 'detail', text: `${under}${line}`, dim: true })
        }
      }

      walk(node.id, under, depth + 1)
    })
  }

  walk(null, indent, 0)

  return rows
}

function rootRowOf(state: FlowState, now: number): Row {
  const root = nodeOf(state, Names.ROOT_ID)
  const activity = root ? activityTextOf(root, now, signalOf(root, now)) : ''
  const mood = root?.status === 'running' ? 'busy' : 'idle'

  return { kind: 'root', text: `main · ${mood}${activity ? ` · ${activity}` : ''}` }
}

function lastEventRowOf(state: FlowState): Row[] {
  const last = state.events.at(-1)

  return last ? [{ kind: 'event', text: `last: ${last.kind} ${last.agentId ?? 'main'} ${last.text}`, dim: true }] : []
}

/**
 * The whole document: header, root, the tree of listed agents (or an empty
 * note), the unlisted group, the last event.
 *
 * @param state the state
 * @param now the time
 * @param expanded the ids (and the unlisted key) the person expanded
 * @returns the rows
 */
export function rowsOf(state: FlowState, now: number, expanded: ReadonlySet<string>): Row[] {
  const all = [...state.nodes.values()].filter(node => node.id !== Names.ROOT_ID)
  const listed = all.filter(node => node.source !== 'event')
  const unlisted = all.filter(node => node.source === 'event')
  const tree = treeRowsOf(listed, now, expanded, '')
  const isGroupOpen = expanded.has(Names.UNLISTED_KEY)
  const group: Row[] =
    unlisted.length === 0
      ? []
      : [
          {
            kind: 'group',
            id: Names.UNLISTED_KEY,
            text: `${isGroupOpen ? '▾' : '▸'} ${Names.UNLISTED_GROUP_LABEL} (${unlisted.length})`,
            isExpanded: isGroupOpen,
          },
          ...(isGroupOpen ? treeRowsOf(unlisted, now, expanded, '   ') : []),
        ]

  return [
    { kind: 'header', text: headerTextOf(state), bold: true },
    rootRowOf(state, now),
    ...(tree.length === 0 ? [{ kind: 'empty' as const, text: `   ${Names.NO_AGENTS_TEXT}`, dim: true }] : tree),
    ...group,
    ...lastEventRowOf(state),
  ]
}

/**
 * The document for a pane seated inline above the prompt: the header, the
 * rows needing attention (waiting first, then slow) or else the running ones,
 * at most INLINE_MAX_ROWS, and a hint to widen the terminal.
 *
 * @param state the state
 * @param now the time
 * @returns the rows
 */
export function inlineRowsOf(state: FlowState, now: number): Row[] {
  const nodes = [...state.nodes.values()].filter(node => node.id !== Names.ROOT_ID).sort(byFirstSeen)
  const rank = (node: FlowNode): number => {
    const signal = signalOf(node, now)

    return signal === 'waiting' ? 0 : signal === 'slow' ? 1 : 2
  }
  const urgent = nodes.filter(node => rank(node) < 2).sort((a, b) => rank(a) - rank(b))
  const shown = (urgent.length > 0 ? urgent : nodes.filter(node => node.status === 'running')).slice(
    0,
    Limits.INLINE_MAX_ROWS,
  )
  const none: ReadonlySet<string> = new Set()

  return [
    { kind: 'header', text: headerTextOf(state), bold: true },
    ...shown.map(node => nodeRowOf(node, now, '', none)),
    { kind: 'hint', text: Names.WIDEN_TEXT, dim: true },
  ]
}
