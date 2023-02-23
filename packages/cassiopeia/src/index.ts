import { REGEX, STORE } from './constants'
import { createMatcher } from './create-matcher'
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
  Unsubscribe,
  Update,
  Variables
} from './types'

const append = <T extends Update>(
  log: Update[],
  value: T,
  predicate: (value: Update) => boolean
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
    variablesCache: new Set(),
    iterators: new Map(),
    matcher: undefined,
    state: TypeState.Locked,
    subscriptions: new Set()
  }

  const scheduler = createScheduler(store)

  const updatePlugin = (isAsync = __BROWSER__) => {
    append(
      store.log,
      {
        type: TypeUpdate.Plugin,
        isAsync
      },
      (value) => value.type === TypeUpdate.Plugin
    )

    // console.log(store.log.map((value) => JSON.stringify(value, null, '  ')))

    scheduler.update()
  }

  const update: Cassiopeia['update'] = (
    createVariables,
    isAsync = __BROWSER__
  ) => {
    append(
      store.log,
      {
        type: TypeUpdate.Source,
        isAsync,
        createVariables
      },
      (value) => value.type === TypeUpdate.Source
    )

    // console.log(store.log.map((value) => JSON.stringify(value, null, '  ')))

    scheduler.update()
  }

  options.plugins.forEach(({ plugin }) => {
    plugin(store.iterators, (isAsync) => updatePlugin(isAsync))
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
