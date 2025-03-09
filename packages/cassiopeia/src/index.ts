import { PLUGIN, REGEX, STORE } from './constants'
import { createMatcher } from './create-matcher'
import { scheduleUpdate } from './schedule-update'
import {
  type Cassiopeia,
  type CassiopeiaInstance,
  type Iterator,
  type Iterators,
  type Options,
  type Plugin,
  type Store,
  type StyleSheet,
  type StyleSheetPartial,
  type Subscription,
  TypeAction,
  TypeState,
  type Unsubscribe,
  type UpdatePlugin,
  type UpdateSource,
  type Variables,
} from './types'
import { append } from './utilities/append'

export function createCassiopeia(options: Options): Cassiopeia {
  const store: Store = {
    cache: new Set(),
    deferEvery: 8,
    iterators: new Map(),
    log: [],
    matcher: undefined,
    state: TypeState.Locked,
    subscriptions: new Set(),
  }

  const updatePlugin: UpdatePlugin = async (isAsync = __PLATFORM__ === 'browser') => {
    append(
      store.log,
      {
        isAsync,
        type: TypeAction.UpdatePlugin,
      },
      (value) => value.type === TypeAction.UpdatePlugin,
    )

    return await scheduleUpdate(store)
  }

  const update: UpdateSource = async (createVariables, isAsync = __PLATFORM__ === 'browser') => {
    append(
      store.log,
      {
        createVariables,
        isAsync,
        type: TypeAction.UpdateSource,
      },
      (value) => value.type === TypeAction.UpdateSource,
    )

    return await scheduleUpdate(store)
  }

  options.plugins.forEach((plugin) => plugin[PLUGIN](store.iterators, updatePlugin))

  store.state = TypeState.None

  const subscribe = (subscription: Subscription): Unsubscribe => {
    store.subscriptions.add(subscription)

    return () => store.subscriptions.delete(subscription)
  }

  return {
    [STORE]: store,
    subscribe,
    update,
  }
}

export const renderToString = <T extends CassiopeiaInstance>(cassiopeia: T): StyleSheet[] => {
  const store = cassiopeia[STORE]

  const matcher = createMatcher(store.log, store)

  let cursor = matcher.next()

  while (cursor.done !== true) {
    cursor = matcher.next()
  }

  return cursor.value ?? []
}

export { PLUGIN, REGEX, STORE }
export type {
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
  Unsubscribe,
  UpdatePlugin,
  UpdateSource,
  Variables,
}
