import { describe, expect, test, tier } from 'claude-code/testing'

import Model from '../hooks/model'
import Views from '../hooks/views'
import Fixtures from './fixtures'

tier('user')

type Fake = { type: string; props: Record<string, unknown>; children: unknown[] }

const ctor =
  (type: string) =>
  (props: Record<string, unknown>): Fake => {
    const { children, ...rest } = props

    return { type, props: rest, children: (children as unknown[]) ?? [] }
  }

const ui = { Box: ctor('Box'), Text: ctor('Text'), Button: ctor('Button') } as unknown as Views.Ui

describe('pane-view', () => {
  test('one column Box holds one child per row', () => {
    const rows = Model.rowsOf(Model.initialState(0), 1, new Set())
    const tree = Views.paneView(ui, rows, { onToggle: () => undefined }) as unknown as Fake

    expect(tree.type).toBe('Box')
    expect(tree.props).toEqual({ flexDirection: 'column' })
    expect(tree.children).toHaveLength(rows.length)
  })

  test('plain rows are Texts styled from the row', () => {
    const rows = Model.rowsOf(Model.initialState(0), 1, new Set())
    const tree = Views.paneView(ui, rows, { onToggle: () => undefined }) as unknown as Fake
    const header = tree.children[0] as Fake
    const empty = tree.children[2] as Fake

    expect(header.type).toBe('Text')
    expect(header.props).toEqual({ bold: true, wrap: 'truncate-end' })
    expect(header.children).toEqual([rows[0]?.text])
    expect(empty.props).toEqual({ dimColor: true, wrap: 'truncate-end' })
  })

  test('an expandable row is a row Box with its Text and a toggle Button that reports the id', () => {
    const state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    const rows = Model.rowsOf(state, 2, new Set())
    const pressed: string[] = []
    const tree = Views.paneView(ui, rows, { onToggle: id => pressed.push(id) }) as unknown as Fake
    const row = tree.children[2] as Fake
    const [text, button] = row.children as [Fake, Fake]

    expect(row.props).toEqual({ flexDirection: 'row' })
    expect(text.type).toBe('Text')
    expect(text.props).toEqual({ color: 'yellow', wrap: 'truncate-end' })
    expect(text.children).toEqual([`${rows[2]?.text} `])
    expect(button.type).toBe('Button')
    expect(button.props.key).toBe('toggle:a')
    expect(button.props.plain).toBe(true)
    expect(button.children).toEqual(['[+]'])
    ;(button.props.onPress as () => void)()
    expect(pressed).toEqual(['a'])
  })

  test('an expanded row shows [-]', () => {
    const state = Model.onSpawn(Model.initialState(0), Fixtures.spawnOf('a'), 1)
    const rows = Model.rowsOf(state, 2, new Set(['a']))
    const tree = Views.paneView(ui, rows, { onToggle: () => undefined }) as unknown as Fake
    const row = tree.children[2] as Fake
    const button = row.children[1] as Fake

    expect(button.children).toEqual(['[-]'])
  })
})
