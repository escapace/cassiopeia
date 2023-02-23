import { Matcher, Store, TypeState, TypeUpdateState, Update } from './types'

import { createMatcher } from './create-matcher'

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
      store.subscriptions.forEach((subscription) => {
        subscription(value.accumulator)
      })

      log.forEach((value) => {
        value.state = TypeUpdateState.Done
      })

      store.log = store.log.filter(
        (value) => value.state !== TypeUpdateState.Done
      )

      if (value.variablesCache !== undefined) {
        store.variablesCache = value.variablesCache
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
    log.forEach((value) => {
      value.state = TypeUpdateState.Scheduled
    })

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
