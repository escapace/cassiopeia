import {
  cloneTerminatingReducers,
  isTerminatingReducerNotTerminated,
  TERMINATING_REDUCER_CANCEL,
  TERMINATING_REDUCER_COMPLETE,
  type TerminatingReducerNext,
} from './create-terminating-reducers'
import type {
  CassiopeiaOrchestrator,
  CassiopeiaStateMachineContext,
  CassiopeiaStyleSheet,
} from './types'

/**
 * Orchestrates stylesheet generation by coordinating cached and new custom property key-suffix pairs across multiple reducers.
 *
 * @param context - State machine context containing cache, optional generator, reducers, and target reducer keys
 * @returns Terminating reducer that collects complete stylesheets from all participating reducers
 *
 * Processes custom property key-suffix pairs. Each pair is reconstructed into a triple-dash custom
 * property string (`---${key}-${suffix}`) and fed to the corresponding reducer. Reducers that
 * complete during processing are removed from the active set. Upon termination, collects stylesheet
 * results from all remaining reducers and transforms them into complete `CassiopeiaStyleSheet`
 * objects with metadata.
 */
export function* createOrchestrator(
  context: Pick<CassiopeiaStateMachineContext, 'generator' | 'reducers' | 'updateReducerKeys'>,
): CassiopeiaOrchestrator {
  const { generator, updateReducerKeys } = context

  // clone target reducers to fresh state for new processing cycle
  const reducers = cloneTerminatingReducers(context.reducers)

  let token: TerminatingReducerNext<undefined>

  const keys = Object.keys(reducers)

  // Determine target reducer keys - either all keys or filtered subset (UpdateType.Reducer)
  const keysIncluded = new Set(
    updateReducerKeys === undefined
      ? keys
      : keys.filter((value) => updateReducerKeys.includes(value)),
  )

  const iterator = generator![Symbol.iterator]()

  while (isTerminatingReducerNotTerminated((token = yield))) {
    const { done, value } = iterator.next()

    if (done === true) {
      break
    }

    const [key, suffix] = value

    // Skip if reducer key not in target set
    if (!keysIncluded.has(key)) {
      continue
    }

    // Reconstruct triple-dash custom property string
    const customProperty = `---${key}-${suffix}`

    // Feed custom property to target reducer, remove if completed
    if (reducers[key].next(customProperty).done === true) {
      keysIncluded.delete(key)
    }
  }

  const values: CassiopeiaStyleSheet[] = []

  const isCancel = token === TERMINATING_REDUCER_CANCEL

  // Finalize reducers and collect stylesheet results
  for (const key of keysIncluded) {
    const reducer = reducers[key]

    if (isCancel) {
      // Send cancellation signal to remaining reducers
      reducer.next(TERMINATING_REDUCER_CANCEL)
    } else {
      // Send completion signal and collect results
      const { done, value } = reducer.next(TERMINATING_REDUCER_COMPLETE)

      if (done === true && value !== undefined) {
        // Transform partial stylesheets into complete CassiopeiaStyleSheet objects
        if (Array.isArray(value)) {
          values.push(...value.map((value, index) => {
            value.key = key
            value.index ??= index

            return value as CassiopeiaStyleSheet
          }))
        } else {
          value.key = key
          value.index ??= 0

          values.push(value as CassiopeiaStyleSheet)
        }
      }
    }
  }

  return isCancel
    ? undefined
    : {
        keys,
        values,
      }
}
