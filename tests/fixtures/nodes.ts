import type { SpawnInput } from '../../hooks/model'

/**
 * A spawn as the Agent tool raises it, with the fields a test cares about
 * overridden.
 */
export function spawnOf(id: string, overrides: Partial<SpawnInput> = {}): SpawnInput {
  return {
    agentId: id,
    subagentType: 'Explore',
    description: `task ${id}`,
    background: false,
    fork: false,
    prompt: `Do task ${id}`,
    ...overrides,
  }
}
