import { REGEX, STORE } from './constants'
import { createMatcher } from './create-matcher'
import { createScheduler } from './create-scheduler'
import {
  ActionUpdate,
  Cassiopeia,
  CassiopeiaInstance,
  Iterator,
  Iterators,
  Options,
  Plugin,
  Store,
  StyleSheet,
  StyleSheetPartial,
  Subscription,
  TypeAction,
  TypeState,
  Unsubscribe,
  UpdatePlugin,
  UpdateSource,
  Variables
} from './types'

const append = <T extends ActionUpdate>(
  log: ActionUpdate[],
  value: T,
  predicate: (value: ActionUpdate) => boolean
) => {
  const i = log.findIndex(predicate)

  if (i === -1) {
    log.push(value)
  } else {
    log[i] = value
  }
}

export function createCassiopeia(options: Options): Cassiopeia {
  const store: Store = {
    log: [],
    cache: new Set(),
    iterators: new Map(),
    matcher: undefined,
    state: TypeState.Locked,
    subscriptions: new Set()
  }

  const scheduler = createScheduler(store)

  const updatePlugin: UpdatePlugin = async (isAsync = __BROWSER__) => {
    append(
      store.log,
      {
        type: TypeAction.UpdatePlugin,
        isAsync
      },
      (value) => value.type === TypeAction.UpdatePlugin
    )

    return await scheduler.update()
  }

  const update: UpdateSource = async (
    createVariables,
    isAsync = __BROWSER__
  ) => {
    append(
      store.log,
      {
        type: TypeAction.UpdateSource,
        isAsync,
        createVariables
      },
      (value) => value.type === TypeAction.UpdateSource
    )

    return await scheduler.update()
  }

  options.plugins.forEach(({ plugin }) => {
    plugin(store.iterators, async (isAsync) => await updatePlugin(isAsync))
  })

  store.state = TypeState.None

  const subscribe = (subscription: Subscription): Unsubscribe => {
    store.subscriptions.add(subscription)

    return () => store.subscriptions.delete(subscription)
  }

  return {
    [STORE]: store,
    update,
    subscribe
  }
}

export const renderToString = <T extends CassiopeiaInstance>(
  cassiopeia: T
): StyleSheet[] => {
  const store = cassiopeia[STORE]

  const matcher = createMatcher(store.log, store)

  let cursor = matcher.next()

  while (cursor.done !== true) {
    cursor = matcher.next()
  }

  return cursor.value?.accumulator ?? []
}

export { REGEX, STORE }
export type {
  Cassiopeia,
  Iterator,
  Iterators,
  Options,
  Plugin,
  CassiopeiaInstance,
  Store,
  StyleSheet,
  StyleSheetPartial,
  UpdateSource,
  UpdatePlugin,
  Subscription,
  Unsubscribe,
  Variables
}
