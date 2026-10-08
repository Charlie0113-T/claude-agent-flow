import type { EngineInterface, Hook, HookStream, On, StreamHook, TurnStepChunk, TurnStepInput, TurnStepResult } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import { register } from '../hooks/register'

tier('user')

const STEP: TurnStepInput = { turnId: 'turn', index: 0, model: 'test', messageCount: 1 }
const RESULT: TurnStepResult = { turnId: 'turn', index: 0, answer: 'done', toolUses: [], stopReason: 'end_turn', usage: null }
const CHUNKS: TurnStepChunk[] = Array.from({ length: 8 }, (_, index) => ({ kind: 'text', index: 0, text: `${index}` }))

/** Capture the real registered hooks; only the host calls needed to bind a session are answered. */
async function hooksOf(bindHost = true) {
  const handlers = new Map<string, unknown>()
  const on = ((event: string, ...args: unknown[]) => { handlers.set(event, args.at(-1)) }) as unknown as On
  let clockCalls = 0
  const engine = {
    clock: {
      now: async () => ++clockCalls,
      after: () => ({ cancel() {} }),
    },
    command: { register: async () => undefined },
    agent: { list: async () => [] },
    store: { get: async () => undefined },
  } as unknown as EngineInterface

  register(on)

  if (bindHost) {
    const start = handlers.get('session.start') as Hook<'session.start'>

    const next = (async () => ({ cwd: '/work' })) as unknown as Parameters<Hook<'session.start'>>[2]

    await start(engine, { surface: 'terminal', isInteractive: true, cwd: '/work' }, next)
  }

  clockCalls = 0

  return {
    step: handlers.get('turn.step') as StreamHook<'turn.step'>,
    engine,
    clockCalls: () => clockCalls,
  }
}

function streamOf(chunks: TurnStepChunk[], closed = () => {}) {
  const stream = (async function* () {
    try {
      yield* chunks

      return RESULT
    } finally {
      closed()
    }
  })()

  return Object.assign(stream, { result: Promise.resolve(RESULT) }) as HookStream<TurnStepChunk, TurnStepResult>
}

function nextOf(stream: HookStream<TurnStepChunk, TurnStepResult>) {
  return (() => stream) as unknown as Parameters<StreamHook<'turn.step'>>[2]
}

async function drain(stream: ReturnType<StreamHook<'turn.step'>>) {
  const chunks: TurnStepChunk[] = []
  let piece = await stream.next()

  while (!piece.done) {
    chunks.push(piece.value)
    piece = await stream.next()
  }

  return { chunks, result: piece.value }
}

describe('turn.step', () => {
  test('main-loop chunks and result pass through without clock calls', async () => {
    const hooks = await hooksOf()
    const response = await drain(hooks.step(hooks.engine, STEP, nextOf(streamOf(CHUNKS))))

    expect(response.chunks).toEqual(CHUNKS)
    expect(response.result).toBe(RESULT)
    expect(hooks.clockCalls()).toBe(0)
  })

  test('subagent chunks and result pass through with the host bound', async () => {
    const hooks = await hooksOf()
    const response = await drain(hooks.step(hooks.engine, { ...STEP, agentId: 'a' }, nextOf(streamOf(CHUNKS))))

    expect(response.chunks).toEqual(CHUNKS)
    expect(response.result).toBe(RESULT)
    expect(hooks.clockCalls()).toBe(CHUNKS.length)
  })

  test('subagent steps pass through before the host binds', async () => {
    const hooks = await hooksOf(false)
    const response = await drain(hooks.step(hooks.engine, { ...STEP, agentId: 'a' }, nextOf(streamOf(CHUNKS))))

    expect(response.chunks).toEqual(CHUNKS)
    expect(response.result).toBe(RESULT)
    expect(hooks.clockCalls()).toBe(0)
  })

  test('cutting a subagent step short closes the stream underneath', async () => {
    const hooks = await hooksOf()
    let closed = false
    const stream = streamOf(CHUNKS, () => { closed = true })
    const response = hooks.step(hooks.engine, { ...STEP, agentId: 'a' }, nextOf(stream))

    expect((await response.next()).value).toBe(CHUNKS[0])
    await response.return()
    expect(closed).toBe(true)
  })
})
