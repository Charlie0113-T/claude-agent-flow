import type { FlowState } from './flow-state'
import { initialState } from './flow-state'

/**
 * What `/clear` and `/resume` do to the tree: a new session's state, keeping
 * only what belongs to the pane (its belief about being open, columns,
 * expansion) and which surface the session started on.
 *
 * @param state the state
 * @param now the new session's start time
 * @returns the state
 */
export function resetSession(state: FlowState, now: number): FlowState {
  return { ...initialState(now), pane: state.pane, startedSurface: state.startedSurface }
}
