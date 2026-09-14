import type { ElementTable } from 'claude-code'

/**
 * The element constructors the pane draws with, destructured from the table
 * `$.ui.resolve(e)` hands the render hook. Every surface carries all three.
 */
export type Ui = Pick<ElementTable, 'Box' | 'Text' | 'Button'>
