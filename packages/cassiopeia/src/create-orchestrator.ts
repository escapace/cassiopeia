import {
  createTerminatingReducers,
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
  context: Pick<
    CassiopeiaStateMachineContext,
    'generator' | 'reducerFactories' | 'updateReducerKeys'
  >,
): CassiopeiaOrchestrator {
  const { generator, reducerFactories, updateReducerKeys } = context

  const keys = Object.keys(reducerFactories)
  const reducers = createTerminatingReducers(reducerFactories, updateReducerKeys ?? keys)
  const iterator = generator![Symbol.iterator]()

  let token: TerminatingReducerNext<undefined>

  while (isTerminatingReducerNotTerminated((token = yield))) {
    const { done, value } = iterator.next()

    if (done === true) {
      break
    }

    const [key, suffix] = value

    const reducer = reducers[key]

    // Skip if reducer key not present
    if (reducer === undefined) {
      continue
    }

    // Reconstruct triple-dash custom property string
    const customProperty = `---${key}-${suffix}`

    // Feed custom property to target reducer, remove if completed
    if (reducers[key].next(customProperty).done === true) {
      Reflect.deleteProperty(reducers, key)
    }
  }

  const values: CassiopeiaStyleSheet[] = []

  const isCancel = token === TERMINATING_REDUCER_CANCEL

  // Finalize reducers and collect stylesheet results
  for (const key of Object.keys(reducers)) {
    const reducer = reducers[key]

    if (isCancel) {
      // Send cancellation signal to remaining reducers
      reducer.next(TERMINATING_REDUCER_CANCEL)
      continue
    }

    // Send completion signal and collect results
    const { done, value } = reducer.next(TERMINATING_REDUCER_COMPLETE)

    if (done !== true || value === undefined) {
      continue
    }

    // Transform partial stylesheets into complete CassiopeiaStyleSheet objects
    if (Array.isArray(value)) {
      values.push(
        ...value.map((value, index) => {
          value.key = key
          value.index ??= index

          return value as CassiopeiaStyleSheet
        }),
      )
    } else {
      value.key = key
      value.index ??= 0

      values.push(value as CassiopeiaStyleSheet)
    }
  }

  return isCancel
    ? undefined
    : {
        keys,
        values,
      }
}
