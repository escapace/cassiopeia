import { REGEX, STORE } from './constants'
import { createScheduler } from './create-scheduler'
import {
  Cassiopeia,
  CassiopeiaInstance,
  Iterator,
  Iterators,
  Options,
  Plugin,
  Register,
  Store,
  StyleSheet,
  StyleSheetPartial,
  Subscription,
  TypeState,
  TypeUpdate,
  TypeUpdateState,
  Unsubscribe,
  UpdatePlugin,
  UpdateSource,
  Variables
} from './types'
import { createMatcher } from './create-matcher'

export function createCassiopeia(options: Options): Cassiopeia {
  const store: Store = {
    log: [],
    variablesCache: new Set(),
    iterators: [],
    matcher: undefined,
    state: TypeState.Locked,
    subscriptions: new Set()
  }

  const scheduler = createScheduler(store)

  const updatePlugin = (index: number, isAsync = __BROWSER__) => {
    const i = store.log.findIndex(
      (value) =>
        value.type === TypeUpdate.Plugin &&
        value.index === index &&
        value.state === TypeUpdateState.None &&
        isAsync === value.isAsync
    )

    const value: UpdatePlugin = {
      type: TypeUpdate.Plugin,
      state: TypeUpdateState.None,
      isAsync,
      index
    }

    if (i === -1) {
      store.log.push(value)
    } else {
      store.log[i] = value
    }

    // console.log(store.log.map((value) => value.state))

    scheduler.update()
  }

  const update: Cassiopeia['update'] = (
    createVariables,
    isAsync = __BROWSER__
  ) => {
    const i = store.log.findIndex(
      (value) =>
        value.type === TypeUpdate.Source &&
        value.state === TypeUpdateState.None &&
        isAsync === value.isAsync
    )

    const value: UpdateSource = {
      type: TypeUpdate.Source,
      state: TypeUpdateState.None,
      isAsync,
      createVariables
    }

    if (i === -1) {
      store.log.push(value)
    } else {
      store.log[i] = value
    }

    // console.log(store.log.map((value) => value.state))

    scheduler.update()
  }

  store.iterators = options.plugins.map(({ plugin }, index): Iterators => {
    const iterators: Iterators = new Map()

    plugin(iterators, (isAsync) => updatePlugin(index, isAsync))

    return iterators
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
  Register,
  Store,
  StyleSheet,
  StyleSheetPartial,
  Subscription,
  Unsubscribe,
  Variables
}
