/**
 * The JSX globals a hooks module has at run time, for bun test: `h` builds
 * plain data, calling a constructor tag with its props and flattened
 * children, and `Fragment` is a column Box, as the engine's is.
 */
type Element = { type: string; props: Record<string, unknown>; children: unknown[] }
type Constructor = (props: Record<string, unknown>) => unknown

const h = (
  tag: unknown,
  props: Record<string, unknown> | null | undefined,
  ...children: unknown[]
): unknown => {
  const flat = children
    .flat(Infinity)
    .filter(child => child !== null && child !== undefined && child !== false)

  if (typeof tag === 'function') {
    return (tag as Constructor)({ ...(props ?? {}), children: flat })
  }

  const element: Element = { type: String(tag), props: props ?? {}, children: flat }

  return element
}

const Fragment = (props: { children?: unknown[] }): Element => ({
  type: 'Box',
  props: { flexDirection: 'column' },
  children: props.children ?? [],
})

Object.assign(globalThis, { h, Fragment })

export {}
