import { REGEX, SOURCE, STORE } from './constants'
import {
  Cassiopeia,
  CassiopeiaInstance,
  Deregister,
  Iterator,
  Iterators,
  Matcher,
  Options,
  Plugin,
  Register,
  Source,
  Store,
  StyleSheet,
  StyleSheetPartial,
  Subscription,
  TypeState,
  TypeUpdate,
  Unsubscribe,
  Variables
} from './types'
import { createMatcher } from './utilities/create-matcher'

function schedulerTask(
  matcher: Matcher,
  store: Store,
  isAsync = __BROWSER__
): void {
  if (matcher === store.matcher && store.update === TypeUpdate.Running) {
    const { done, value } = matcher.next()

    if (done !== true) {
      if (isAsync) {
        setTimeout(() => schedulerTask(matcher, store, isAsync))
      } else {
        schedulerTask(matcher, store, isAsync)
      }

      return
    }

    store.subscriptions.forEach((subscription) => {
      subscription(value)
    })

    store.update = TypeUpdate.None
    store.matcher = undefined
  } else {
    /* matcher has been updated or the state has changed, garbage collect */
    matcher.next(true)
  }
}

function schedulerFrame(
  store: Store,
  createVariables: undefined | (() => Variables),
  isAsync = __BROWSER__
) {
  if (store.update === TypeUpdate.Scheduled) {
    const matcher = (store.matcher = createMatcher(
      createVariables === undefined ? undefined : createVariables(),
      store.iterators,
      store.cache
    ))

    store.update = TypeUpdate.Running

    schedulerTask(matcher, store, isAsync)
  }
}

function createScheduler(store: Store) {
  const lock = (lock: boolean) => {
    store.matcher = undefined

    store.update = lock ? TypeUpdate.Locked : TypeUpdate.None
  }

  const update = (createVariables?: () => Variables, isAsync = __BROWSER__) => {
    if (store.update === TypeUpdate.Running) {
      store.matcher = undefined
      store.update = TypeUpdate.None
    }

    if (store.update === TypeUpdate.None) {
      store.update = TypeUpdate.Scheduled

      if (isAsync) {
        requestAnimationFrame(() =>
          schedulerFrame(store, createVariables, isAsync)
        )
      } else {
        schedulerFrame(store, createVariables, isAsync)
      }
    }
  }

  return { update, lock }
}

export function createCassiopeia(options: Options): Cassiopeia {
  const store: Store = {
    cache: new Set(),
    iterators: new Map(),
    matcher: undefined,
    state: TypeState.Inactive,
    update: TypeUpdate.Locked,
    subscriptions: new Set()
  }

  const plugins = options.plugins.map(({ plugin }) => plugin(store.iterators))
  const scheduler = createScheduler(store)
  const source =
    options.source === undefined
      ? undefined
      : options.source(store, scheduler.update)[SOURCE]

  const init = () => {
    if (store.state === TypeState.Activating) {
      plugins.forEach((values) =>
        values.register((isAsync) => scheduler.update(undefined, isAsync))
      )

      scheduler.lock(false)

      if (source !== undefined) {
        source.start()
      }

      store.state = TypeState.Active
    }
  }

  const stop = () => {
    if (store.state !== TypeState.Inactive) {
      store.state = TypeState.Inactive

      if (source?.stop !== undefined) {
        source.stop()
      }

      scheduler.lock(true)
      plugins.forEach((value) => value.deregister())
    }
  }

  const start = () => {
    if (store.state === TypeState.Inactive) {
      store.state = TypeState.Activating

      if (__BROWSER__ && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
      } else {
        init()
      }
    }
  }

  const isActive = () => store.state === TypeState.Active
  const subscribe = (subscription: Subscription): Unsubscribe => {
    store.subscriptions.add(subscription)

    return () => store.subscriptions.delete(subscription)
  }

  return {
    [STORE]: store,
    isActive,
    start,
    stop,
    update: scheduler.update,
    subscribe
  }
}

export const renderToString = <T extends CassiopeiaInstance>(cassiopeia: T) => {
  const store = cassiopeia[STORE]

  if (store.state === TypeState.Active) {
    const matcher = createMatcher(undefined, store.iterators, store.cache)

    let cursor = matcher.next()

    while (cursor.done !== true) {
      cursor = matcher.next()
    }

    return cursor.value
  }

  return undefined
}

export { TypeState, REGEX, STORE, SOURCE }
export type {
  Cassiopeia,
  Deregister,
  Iterator,
  Iterators,
  Options,
  Plugin,
  CassiopeiaInstance,
  Register,
  Source,
  Store,
  StyleSheet,
  StyleSheetPartial,
  Subscription,
  Unsubscribe,
  Variables
}
