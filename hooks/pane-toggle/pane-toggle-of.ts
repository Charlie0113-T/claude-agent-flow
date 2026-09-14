export type PaneBelief = {
  /** The plugin opened the pane and has not closed it. */
  isBelievedOpen: boolean
  /** A redraw asked just now was answered by a `ui.render` of the pane. */
  wasDrawnWhenProbed: boolean
}

/**
 * What `/flow` does: close only when the plugin opened the pane and it still
 * draws (the person may have closed it with no event the plugin hooks);
 * otherwise open.
 *
 * @param pane the belief and the probe's answer
 * @returns `open` or `close`
 */
export function paneToggleOf(pane: PaneBelief): 'open' | 'close' {
  return pane.isBelievedOpen && pane.wasDrawnWhenProbed ? 'close' : 'open'
}
