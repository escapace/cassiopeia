import { PLUGIN, REGEX, STORE } from './constants'
import { createMatcher } from './create-matcher'
import { scheduleUpdate } from './schedule-update'
import {
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
import { append } from './utilities/append'

export function createCassiopeia(options: Options): Cassiopeia {
  const rate =
    Number.isInteger(options.rate) && (options.rate as number) > 0
      ? (options.rate as number)
      : 8

  const store: Store = {
    cache: new Set(),
    iterators: new Map(),
    log: [],
    matcher: undefined,
    rate,
    state: TypeState.Locked,
    subscriptions: new Set()
  }

  const updatePlugin: UpdatePlugin = async (isAsync = __BROWSER__) => {
    append(
      store.log,
      {
        type: TypeAction.UpdatePlugin,
        isAsync
      },
      (value) => value.type === TypeAction.UpdatePlugin
    )

    return await scheduleUpdate(store)
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

    return await scheduleUpdate(store)
  }

  options.plugins.forEach((plugin) =>
    plugin[PLUGIN](store.iterators, updatePlugin)
  )

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

  return cursor.value ?? []
}

export { REGEX, STORE, PLUGIN }
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
