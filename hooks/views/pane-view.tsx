/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type { Row } from '../model'
import type { Ui } from './kit'

export type PaneActions = {
  /** Expands or collapses the node (or the unlisted group) with this id. */
  onToggle: (id: string) => void
}

type TextStyle = { color?: string; dimColor?: boolean; bold?: boolean; wrap: 'truncate-end' }

function styleOf(row: Row): TextStyle {
  return {
    ...(row.color !== undefined ? { color: row.color } : {}),
    ...(row.dim ? { dimColor: true } : {}),
    ...(row.bold ? { bold: true } : {}),
    wrap: 'truncate-end',
  }
}

/**
 * The pane's body: one line per row; an expandable row is a row Box holding
 * the line and a `[+]` / `[-]` Button whose press toggles the id.
 *
 * @param ui the surface's elements
 * @param rows the document
 * @param actions what a press does
 * @returns the tree
 */
export function paneView(ui: Ui, rows: readonly Row[], actions: PaneActions): RenderElement {
  const { Box, Text, Button } = ui

  return (
    <Box flexDirection="column">
      {rows.map(row => {
        const id = row.id

        if (id === undefined) {
          return <Text {...styleOf(row)}>{row.text}</Text>
        }

        return (
          <Box flexDirection="row">
            <Text {...styleOf(row)}>{`${row.text} `}</Text>
            <Button key={`toggle:${id}`} plain onPress={() => actions.onToggle(id)}>
              {row.isExpanded ? '[-]' : '[+]'}
            </Button>
          </Box>
        )
      })}
    </Box>
  )
}
