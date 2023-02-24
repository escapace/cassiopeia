import { ActionUpdate, Matcher, Store, TypeState } from './types'

import { createMatcher } from './create-matcher'
import { filter } from './utilities/filter'
import { promisify } from './utilities/promisify'

async function schedulerTask(
  isAsync: boolean,
  log: ActionUpdate[],
  matcher: Matcher,
  store: Store
): Promise<boolean> {
  if (matcher === store.matcher && store.state === TypeState.Running) {
    const { done, value } = matcher.next()

    if (done !== true) {
      if (isAsync) {
        return await promisify<boolean>(
          requestAnimationFrame,
          async () => await schedulerTask(isAsync, log, matcher, store)
        )
      } else {
        return await schedulerTask(isAsync, log, matcher, store)
      }
    }

    const cancelled = value === undefined

    if (!cancelled) {
      // update the subscriptions
      store.subscriptions.forEach((subscription) => {
        subscription(value.accumulator)
      })

      // remove processed items from log
      filter(store.log, (value) => !log.includes(value))

      // update the cache
      if (value.cache !== undefined) {
        store.cache.clear()
        store.cache = value.cache
      }

      return true
    }

    store.state = TypeState.None
    store.matcher = undefined
  } else {
    /* matcher has been updated or the state has changed, garbage collect */
    matcher.next(true)
  }

  return false
}

async function schedulerFrame(
  isAsync: boolean,
  log: ActionUpdate[],
  store: Store
): Promise<boolean> {
  if (store.state === TypeState.Scheduled && log.length !== 0) {
    store.state = TypeState.Running

    const matcher = (store.matcher = createMatcher(log, store))

    return await schedulerTask(isAsync, log, matcher, store)
  }

  return false
}

export function createScheduler(store: Store) {
  const update = async () => {
    if (store.state === TypeState.Running) {
      // the matcher will be cancelled in schedulerTask()
      store.matcher = undefined
      store.state = TypeState.None
    }

    if (store.state === TypeState.None) {
      store.state = TypeState.Scheduled

      // copy the current items in the log into an array
      const log = [...store.log]

      const isAsync = !log.some((value) => !value.isAsync)

      if (isAsync) {
        return await promisify<boolean>(
          requestAnimationFrame,
          async () => await schedulerFrame(isAsync, log, store)
        )
      } else {
        return await schedulerFrame(isAsync, log, store)
      }
    }

    return false
  }

  return { update }
}
