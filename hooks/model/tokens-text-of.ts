import type { Usage } from './flow-state'

/**
 * Input plus output tokens, compact: `820 tok`, `4.1k tok`; nothing at zero.
 *
 * @param usage the node's summed usage
 * @returns the text
 */
export function tokensTextOf(usage: Usage): string {
  const total = usage.input + usage.output

  if (total === 0) {
    return ''
  }

  return total < 1000 ? `${total} tok` : `${(total / 1000).toFixed(1)}k tok`
}
