import { ID, REGEX, STORE } from './constants'
import {
  Cassiopeia,
  Deregister,
  Iterator,
  Iterators,
  Options,
  Plugin,
  Register,
  Store,
  TypeState,
  Variables
} from './types'
import { createMatcher } from './utilities/create-matcher'

function* createVariableIterator(strings: string[]): Variables {
  for (const string of strings) {
    for (const match of string.matchAll(REGEX)) {
      const cancelled = yield match as [string, string, string]

      if (cancelled) {
        return
      }
    }
  }
}

const NOOP = () => undefined

export function cassiopeia(options: Options): Cassiopeia {
  const store: Store = {
    state: TypeState.Inactive,
    id: options.id ?? ID,
    iterators: new Map()
  }

  const plugins = options.plugins.map((plugin) => plugin(store.iterators))

  const stop = () => {
    if (store.state !== TypeState.Inactive) {
      store.state = TypeState.Inactive

      plugins.forEach((value) => value.deregister())
    }
  }

  const start = () => {
    if (store.state === TypeState.Inactive) {
      store.state = TypeState.Activating
      plugins.forEach((plugin) => plugin.register(NOOP))
      store.state = TypeState.Active
    }
  }

  return {
    [STORE]: store,
    start,
    stop,
    update: NOOP,
    isActive: () => store.state === TypeState.Active
  }
}

export const renderToString = (
  cassiopeia: Cassiopeia,
  ...strings: string[]
) => {
  const store = cassiopeia[STORE]

  if (store.state === TypeState.Active) {
    const matcher = createMatcher(
      createVariableIterator(strings),
      store.iterators
    )

    let cursor = matcher.next()

    while (cursor.done !== true) {
      cursor = matcher.next()
    }

    const value =
      cursor.value === undefined
        ? undefined
        : `<style cassiopeia="${store.id}">${cursor.value}</style>`

    return value
  }

  return undefined
}

export type {
  Options,
  Iterators,
  Iterator,
  Register,
  Deregister,
  Cassiopeia,
  Plugin
}
