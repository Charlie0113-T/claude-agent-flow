import { describe, expect, test, tier } from 'claude-code/testing'

import Limits from '../hooks/limits'
import PaneToggle from '../hooks/pane-toggle'

tier('user')

describe('pane-toggle', () => {
  test('/flow closes only a pane believed open that still draws, else opens', () => {
    expect(PaneToggle.paneToggleOf({ isBelievedOpen: true, wasDrawnWhenProbed: true })).toBe('close')
    expect(PaneToggle.paneToggleOf({ isBelievedOpen: true, wasDrawnWhenProbed: false })).toBe('open')
    expect(PaneToggle.paneToggleOf({ isBelievedOpen: false, wasDrawnWhenProbed: false })).toBe('open')
  })

  const facts = {
    startedSurface: 'terminal' as const,
    hasAutoOpened: false,
    closedByPerson: false,
    storedOpen: undefined,
    columns: Limits.AUTO_OPEN_MIN_COLUMNS,
  }

  test('auto-open needs a terminal, a first time, no earlier close and enough columns', () => {
    expect(PaneToggle.shouldAutoOpen(facts)).toBe(true)
    expect(PaneToggle.shouldAutoOpen({ ...facts, startedSurface: null })).toBe(false)
    expect(PaneToggle.shouldAutoOpen({ ...facts, hasAutoOpened: true })).toBe(false)
    expect(PaneToggle.shouldAutoOpen({ ...facts, closedByPerson: true })).toBe(false)
    expect(PaneToggle.shouldAutoOpen({ ...facts, storedOpen: false })).toBe(false)
    expect(PaneToggle.shouldAutoOpen({ ...facts, columns: null })).toBe(false)
    expect(PaneToggle.shouldAutoOpen({ ...facts, columns: Limits.AUTO_OPEN_MIN_COLUMNS - 1 })).toBe(false)
  })

  test('a person who kept it open before gets it from the narrower width', () => {
    expect(PaneToggle.shouldAutoOpen({ ...facts, storedOpen: true, columns: Limits.KEPT_OPEN_MIN_COLUMNS })).toBe(true)
    expect(PaneToggle.shouldAutoOpen({ ...facts, storedOpen: true, columns: Limits.KEPT_OPEN_MIN_COLUMNS - 1 })).toBe(false)
  })
})
