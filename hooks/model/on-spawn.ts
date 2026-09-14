import Limits from '../limits'
import type { FlowNode, FlowState } from './flow-state'
import { newNode, nodeOf, withEvent, withNode } from './flow-state'
import { prune } from './prune'

/**
 * `agent.spawn` as the reducer takes it: the input's facts plus the result's
 * `agentId` and resolved `model`, or its `deny`.
 */
export type SpawnInput = {
  agentId?: string
  deny?: string
  parentAgentId?: string
  subagentType: string
  description: string
  model?: string
  name?: string
  background: boolean
  fork: boolean
  prompt: string
}

/**
 * Records a spawn: a new running node under its parent, or the spawn's facts
 * merged into a node the list added first (that node keeps the list's status).
 *
 * @param state the state
 * @param spawn the spawn
 * @param now when it happened
 * @returns the state
 */
export function onSpawn(state: FlowState, spawn: SpawnInput, now: number): FlowState {
  if (spawn.agentId === undefined) {
    return withEvent(state, {
      at: now,
      kind: 'agent.spawn',
      text: `refused: ${spawn.deny ?? 'no id'} "${spawn.description}"`,
    })
  }

  const facts = {
    type: spawn.subagentType,
    description: spawn.description,
    model: spawn.model,
    name: spawn.name,
    background: spawn.background,
    fork: spawn.fork,
    promptExcerpt: spawn.prompt.slice(0, Limits.PROMPT_EXCERPT_CHARS),
    spawnedAt: now,
    lastEventAt: now,
  }
  const existing = nodeOf(state, spawn.agentId)
  const node: FlowNode = existing
    ? { ...existing, ...facts, parentId: existing.parentId ?? spawn.parentAgentId ?? null }
    : newNode({ id: spawn.agentId, parentId: spawn.parentAgentId ?? null, source: 'spawn', ...facts }, now)

  return prune(
    withEvent(withNode(state, node), {
      at: now,
      kind: 'agent.spawn',
      agentId: spawn.agentId,
      text: `${spawn.subagentType} "${spawn.description}"`,
    }),
  )
}
