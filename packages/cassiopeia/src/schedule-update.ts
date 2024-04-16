import { Action, MatcherReturn, Store, TypeState } from './types'

import { createMatcher } from './create-matcher'
import { filter } from './utilities/filter'

async function reducer(
  isAsync: boolean,
  log: Action[],
  store: Store
): Promise<boolean> {
  if (store.state === TypeState.Scheduled) {
    store.state = TypeState.Running
    const matcher = (store.matcher = createMatcher(log, store))
    let iteratorResult: IteratorResult<undefined, MatcherReturn> | undefined
    let iteration = 0

    while (iteratorResult?.done !== true) {
      if (matcher === store.matcher && store.state === TypeState.Running) {
        iteration++

        iteratorResult = isAsync
          ? await new Promise<IteratorResult<undefined, MatcherReturn>>(
              (resolve) => {
                if (iteration % store.rate === 0) {
                  setTimeout(() => {
                    resolve(matcher.next())
                  }, 0)
                } else {
                  resolve(matcher.next())
                }
              }
            )
          : matcher.next()

        if (iteratorResult.done === true) {
          const { value } = iteratorResult
          const success = value !== undefined

          if (success) {
            // update the subscriptions
            store.subscriptions.forEach((subscription) => {
              subscription(value)
            })

            // remove processed actions from log
            filter(store.log, (action) => !log.includes(action))
          }

          store.state = TypeState.None
          store.matcher = undefined

          return success
        }
      } else {
        /* matcher has been updated or the state has changed, garbage collect */
        matcher.next(true)
        break
      }
    }
  }

  return false
}

export const scheduleUpdate = async (store: Store): Promise<boolean> => {
  if (store.state === TypeState.Running) {
    // the matcher will be cancelled in reducer()
    store.matcher = undefined
    store.state = TypeState.None
  }

  if (store.state === TypeState.None) {
    store.state = TypeState.Scheduled

    // copy action refs into an array
    const log = [...store.log]
    const isAsync = !log.some((value) => !value.isAsync)

    return await (isAsync
      ? new Promise<boolean>((resolve) => {
          ;(__BROWSER__ ? requestAnimationFrame : setTimeout)(() => {
            void reducer(isAsync, log, store).then(resolve)
          })
        })
      : reducer(isAsync, log, store))
  }

  return false
}
