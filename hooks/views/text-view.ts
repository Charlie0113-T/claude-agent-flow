import type { Row } from '../model'

/**
 * The tree as plain text: what `/flow text` prints, and what `/flow` prints
 * where no pane can be drawn.
 *
 * @param rows the document
 * @returns one line per row
 */
export function textView(rows: readonly Row[]): string {
  return rows.map(row => row.text).join('\n')
}
