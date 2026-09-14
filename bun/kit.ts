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

const unavailable = (name: string) => (): never => {
  throw new Error(`${name} is not available under bun test; it needs claude plugin test`)
}

/**
 * A stand-in for `claude-code/testing`'s `mock`, present so a file that
 * imports it by name links under `bun test`. Every member throws: the real
 * one only runs a kit test's `register()` under `claude plugin test`, which
 * `bun test` never does (`tests/*.kit.ts` is outside its glob).
 */
export const mock = { clock: unavailable('mock.clock'), store: unavailable('mock.store'), env: unavailable('mock.env') }
