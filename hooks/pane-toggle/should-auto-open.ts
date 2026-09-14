import type { RenderSurface } from 'claude-code'

import Limits from '../limits'

export type AutoOpenFacts = {
  startedSurface: RenderSurface | null
  hasAutoOpened: boolean
  closedByPerson: boolean
  /** The store's `agent-flow.open`: true, false or anything else for unset. */
  storedOpen: unknown
  columns: number | null
}

/**
 * Whether the first spawn of the session opens the pane by itself: on a
 * terminal, once, unless the person closed it (now or in an earlier
 * session), and only when the terminal is wide enough: 144 columns, or 110
 * for a person who kept it open before.
 *
 * @param facts what is known at the spawn
 * @returns true to open
 */
export function shouldAutoOpen(facts: AutoOpenFacts): boolean {
  if (facts.startedSurface !== 'terminal' || facts.hasAutoOpened || facts.closedByPerson) {
    return false
  }

  if (facts.storedOpen === false || facts.columns === null) {
    return false
  }

  const minimum = facts.storedOpen === true ? Limits.KEPT_OPEN_MIN_COLUMNS : Limits.AUTO_OPEN_MIN_COLUMNS

  return facts.columns >= minimum
}
