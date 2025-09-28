/* eslint-disable typescript/no-explicit-any */
import {
  isTerminatingReducerNotTerminated,
  TERMINATING_REDUCER_CANCEL,
  TERMINATING_REDUCER_COMPLETE,
  type TerminatingReducerNext,
} from './create-terminating-reducers'
import type { CassiopeiaPartialStyleSheet, CassiopeiaReducer } from './types'

export const createMultiplexer = <T extends (...arguments_: any) => CassiopeiaReducer>(
  reducerFactory: T,
  options: Array<Parameters<T>[0]>,
): (() => CassiopeiaReducer) =>
  function* (): CassiopeiaReducer {
    const reducers = options.map((value) => {
      const reducer = reducerFactory(value)
      // A value passed to the first invocation of next() is always ignored.
      reducer.next()
      return reducer
    })

    let token: TerminatingReducerNext<string>

    while (isTerminatingReducerNotTerminated((token = yield))) {
      for (const iterator of reducers) {
        iterator.next(token)
      }
    }

    const values: CassiopeiaPartialStyleSheet[] = []
    const isCancel = token === TERMINATING_REDUCER_CANCEL

    for (const reducer of reducers) {
      if (isCancel) {
        reducer.next(TERMINATING_REDUCER_CANCEL)
      } else {
        const { done, value } = reducer.next(TERMINATING_REDUCER_COMPLETE)

        if (done === true && value !== undefined) {
          if (Array.isArray(value)) {
            values.push(...value)
          } else {
            values.push(value)
          }
        }
      }
    }

    if (isCancel) {
      return undefined
    }

    return values
  }
