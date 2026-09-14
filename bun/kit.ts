import { describe as bunDescribe, expect as bunExpect, test as bunTest } from 'bun:test'

/**
 * The subset of `claude-code/testing` the unit tests use, over bun:test, so
 * the same files run here now and under `claude plugin test` later. `$` and
 * `on` are handed as undefined: a unit test never touches them.
 */
export const describe = bunDescribe
export const expect = bunExpect
export const test = (name: string, fn: ($: unknown, on: unknown) => unknown): void =>
  bunTest(name, () => fn(undefined, undefined))
export const tier = (_tier: string): void => undefined
