declare module 'bun:test' {
  export const describe: (name: string, body: () => void) => void
  export const test: (name: string, body: () => unknown) => void
  export const expect: (received: unknown, message?: string) => Record<string, (...args: unknown[]) => void>
}
