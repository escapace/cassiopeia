import { cacheIterators } from './cache-iterators'
import {
  Action,
  ActionUpdateSource,
  Matcher,
  Store,
  StyleSheet,
  TypeAction
} from './types'
import { findLastIndex } from './utilities/find-last-index'

export function* createMatcher(log: Action[], store: Store): Matcher {
  const seen = new Set<string>()

  // check if log has source update
  const sourceIndex = findLastIndex(
    log,
    (value) => value.type === TypeAction.UpdateSource
  )

  const createVariables =
    sourceIndex === -1
      ? undefined
      : (log[sourceIndex] as ActionUpdateSource).createVariables
  const variables =
    createVariables === undefined ? undefined : createVariables()

  const hasVariables = variables !== undefined

  // if variables are provided we create a new cache
  if (hasVariables) {
    store.cache.clear()
  }

  let cancelled = false

  const iterators = cacheIterators(store.iterators)

  // iterate over variables
  for (const entry of variables ?? store.cache.values()) {
    if (cancelled) {
      break
    }

    const [id, name, variable] = entry

    // deduplicate
    if (seen.has(id)) {
      continue
    }

    seen.add(id)

    // update the cache if we are going over a new source
    if (hasVariables) {
      store.cache.add(entry)
    }

    const iterator = iterators.get(name)

    if (iterator === undefined) {
      continue
    }

    iterator.next(variable)

    cancelled = (yield) === true
  }

  const accumulator: StyleSheet[] = []

  if (cancelled) {
    for (const iterator of iterators.values()) {
      if (iterator !== undefined) {
        iterator.next(true)
      }
    }

    return
  }

  for (const [name, iterator] of iterators.entries()) {
    if (iterator !== undefined) {
      const { done, value } = iterator.next(true)

      if (done === true && value !== undefined) {
        Array.isArray(value)
          ? accumulator.push(
              ...value.map((value) => ({ key: 0, ...value, name }))
            )
          : accumulator.push({ key: 0, ...value, name })
      }
    }
  }

  return accumulator
}
