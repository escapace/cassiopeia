/* eslint-disable typescript/promise-function-async */
import type { CassiopeiaStateMachineContext } from './types'

/**
 * Executes orchestrator processing with dual execution modes for optimal performance across platforms.
 *
 * Drives the orchestrator generator through its complete iteration cycle, choosing between synchronous
 * tight-loop execution and asynchronous cooperative multitasking based on platform requirements.
 *
 * Async mode implements cooperative multitasking by yielding control to the event loop every
 * `deferEvery` iterations using `setTimeout` (default).
 *
 * @param context - Execution context containing orchestrator instance, iteration yield frequency, and async mode flag
 * @returns Stylesheet array on completion, undefined on cancellation or empty result
 */
export const createScheduler = (
  context: Pick<
    CassiopeiaStateMachineContext,
    'defer' | 'deferEvery' | 'orchestrator' | 'updateIsAsync'
  >,
) => {
  const { defer, deferEvery } = context
  const isAsync = context.updateIsAsync
  const orchestrator = context.orchestrator!
  let iterationResult: ReturnType<typeof orchestrator.next>

  if (isAsync) {
    let iteration = 1

    return (async () => {
      while ((iterationResult = orchestrator.next()).done !== true) {
        if (iteration++ % deferEvery === 0) {
          await new Promise<void>((resolve) => {
            defer(resolve)
          })

          if (orchestrator !== context.orchestrator) {
            return undefined
          }
        }
      }

      return iterationResult.value
    })()
  } else {
    // eslint-disable-next-line no-empty
    while ((iterationResult = orchestrator.next()).done !== true) {}
    return iterationResult.value
  }
}
