import { CASSIOPEIA_PLUGIN, CASSIOPEIA_REGEX, CASSIOPEIA_STORE } from './constants'
import { createMatcher } from './create-matcher'
import { scheduleUpdate } from './schedule-update'
import {
  type Cassiopeia,
  type CassiopeiaInstance,
  type Iterator,
  type Iterators,
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
import { upsert, remove } from 'coastal'

export function createCassiopeia(): Cassiopeia {
  const store: Store = {
    cache: new Set(),
    deferEvery: 8,
    iterators: {},
    log: [],
    matcher: undefined,
    state: TypeState.Locked,
    subscriptions: [],
  }

  const plugins: Plugin[] = []

  const updatePlugin: UpdatePlugin = async (isAsync = __PLATFORM__ === 'browser') => {
    upsert(
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
    upsert(
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

  store.state = TypeState.None

  const subscribe = (subscription: Subscription): Unsubscribe => {
    if (!store.subscriptions.includes(subscription)) {
      store.subscriptions.push(subscription)
    }

    return () => {
      remove(store.subscriptions, (value) => value === subscription)
    }
  }

  const cassiopeia: Cassiopeia = {
    [CASSIOPEIA_STORE]: store,
    subscribe,
    update,
    use: (...values: Plugin[]) => {
      let changed = false

      for (const value of values) {
        if (!plugins.includes(value)) {
          plugins.push(value)

          changed ||= true
        }
      }

      plugins.forEach((plugin) => plugin[CASSIOPEIA_PLUGIN](store.iterators, updatePlugin))

      return cassiopeia
    },
  }

  return cassiopeia
}

export const renderToString = <T extends CassiopeiaInstance>(cassiopeia: T): StyleSheet[] => {
  const store = cassiopeia[CASSIOPEIA_STORE]

  const matcher = createMatcher(store.log, store)

  let cursor = matcher.next()

  while (cursor.done !== true) {
    cursor = matcher.next()
  }

  return cursor.value ?? []
}

export { CASSIOPEIA_PLUGIN, CASSIOPEIA_REGEX, CASSIOPEIA_STORE }
export type {
  Cassiopeia,
  CassiopeiaInstance,
  Iterator,
  Iterators,
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

