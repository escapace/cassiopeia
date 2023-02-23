import { Matcher, Store, TypeState, Update } from './types'

import { createMatcher } from './create-matcher'

const filter = <T>(arr: T[], predicate: (value: T) => boolean) => {
  for (let l = arr.length - 1; l >= 0; l -= 1) {
    if (!predicate(arr[l])) arr.splice(l, 1)
  }
}

function schedulerTask(
  matcher: Matcher,
  store: Store,
  log: Update[],
  isAsync: boolean
): void {
  if (matcher === store.matcher && store.state === TypeState.Running) {
    const { done, value } = matcher.next()

    if (done !== true) {
      if (isAsync) {
        setTimeout(() => schedulerTask(matcher, store, log, isAsync))
      } else {
        schedulerTask(matcher, store, log, isAsync)
      }

      return
    }

    if (value !== undefined) {
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
    }

    store.state = TypeState.None
    store.matcher = undefined
  } else {
    /* matcher has been updated or the state has changed, garbage collect */
    matcher.next(true)
  }
}

function schedulerFrame(store: Store, log: Update[], isAsync: boolean) {
  if (store.state === TypeState.Scheduled) {
    const matcher = (store.matcher = createMatcher(log, store))

    store.state = TypeState.Running

    schedulerTask(matcher, store, log, isAsync)
  }
}

export function createScheduler(store: Store) {
  const update = () => {
    if (store.state === TypeState.Running) {
      // the matcher will be cancelled in schedulerTask()
      store.matcher = undefined
      store.state = TypeState.None
    }

    if (store.state === TypeState.None) {
      store.state = TypeState.Scheduled

      // copy the current items in the log into an array
      const log = [...store.log]

      const isSync = log.some((value) => !value.isAsync)
      const isAsync = !isSync

      if (isAsync) {
        requestAnimationFrame(() => schedulerFrame(store, log, isAsync))
      } else {
        schedulerFrame(store, log, isAsync)
      }
    }
  }

  return { update }
}
