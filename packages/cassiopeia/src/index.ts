import { REGEX, SOURCE, STORE } from './constants'
import {
  Cassiopeia,
  Deregister,
  Iterator,
  Iterators,
  Matcher,
  Options,
  Plugin,
  Register,
  Source,
  Store,
  Subscription,
  TypeState,
  TypeUpdate,
  Unsubscribe,
  Variables
} from './types'
import { createMatcher } from './utilities/create-matcher'

function schedulerTask(matcher: Matcher, store: Store): void {
  if (matcher === store.matcher && store.update === TypeUpdate.Running) {
    const { done, value } = matcher.next()

    if (done !== true) {
      if (__BROWSER__) {
        setTimeout(() => schedulerTask(matcher, store))
      } else {
        schedulerTask(matcher, store)
      }
      return
    }

    if (value !== undefined) {
      store.subscriptions.forEach((subscription) => subscription(value))
    }

    store.update = TypeUpdate.None
    store.matcher = undefined
  } else {
    /* matcher has been updated or the state has changed, garbage collect */
    matcher.next(true)
  }
}

function schedulerFrame(store: Store, createVariables?: () => Variables) {
  if (store.update === TypeUpdate.Scheduled) {
    const matcher = (store.matcher = createMatcher(
      createVariables === undefined ? undefined : createVariables(),
      store.iterators,
      store.cache
    ))

    store.update = TypeUpdate.Running

    schedulerTask(matcher, store)
  }
}

function createScheduler(store: Store) {
  const lock = (lock: boolean) => {
    store.matcher = undefined

    store.update = lock ? TypeUpdate.Locked : TypeUpdate.None
  }

  const update = (createVariables?: () => Variables) => {
    if (store.update === TypeUpdate.Running) {
      store.matcher = undefined
      store.update = TypeUpdate.None
    }

    if (store.update === TypeUpdate.None) {
      store.update = TypeUpdate.Scheduled

      if (__BROWSER__) {
        requestAnimationFrame(() => schedulerFrame(store, createVariables))
      } else {
        schedulerFrame(store, createVariables)
      }
    }
  }

  return { update, lock }
}

// const isDocument = (value: Document | ShadowRoot): value is Document =>
//   value.nodeType === 9

// const createStyleElement = (
//   id: string,
//   root: Document | ShadowRoot = document
// ): HTMLStyleElement => {
//   let styleElement =
//     (root.querySelector(`style[cassiopeia=${id}]`) as
//       | HTMLStyleElement
//       | undefined) ?? undefined
//
//   if (styleElement === undefined) {
//     styleElement = document.createElement('style')
//     styleElement.setAttribute('cassiopeia', id)
//
//     if (isDocument(root)) {
//       root.head.insertBefore(styleElement, null)
//     } else {
//       root.appendChild(styleElement)
//     }
//   }
//
//   return styleElement
// }

export function cassiopeia(options: Options): Cassiopeia {
  const store: Store = {
    cache: new Set(),
    iterators: new Map(),
    matcher: undefined,
    state: TypeState.Inactive,
    update: TypeUpdate.Locked,
    subscriptions: new Set()
  }

  const plugins = options.plugins.map((plugin) => plugin(store.iterators))
  const scheduler = createScheduler(store)
  const update = () => scheduler.update()
  const source = options.source(store, scheduler.update)[SOURCE]

  const init = () => {
    if (store.state === TypeState.Activating) {
      plugins.forEach((values) => values.register(update))
      scheduler.lock(false)
      source.start()

      store.state = TypeState.Active
    }
  }

  const stop = () => {
    if (store.state !== TypeState.Inactive) {
      store.state = TypeState.Inactive

      if (source.stop !== undefined) {
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
    update,
    subscribe
  }
}

export const renderToString = (cassiopeia: Cassiopeia) => {
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
  Register,
  Source,
  Store,
  Subscription,
  Unsubscribe,
  Variables
}
