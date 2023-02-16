import type {
  Iterators,
  Matcher,
  StyleSheet,
  Variables,
  VariablesCache
} from '../types'
import { cacheIterators } from './cache-iterators'

export function* createMatcher(
  variables: Variables | undefined,
  iterators: Iterators,
  variablesCache: VariablesCache
): Matcher {
  const seen = new Set<string>()
  const [iteratorsRecord, iteratorsMap] = cacheIterators(iterators)
  const updateCache = variables !== undefined

  if (updateCache) {
    variablesCache.clear()
  }

  let cancelled = false

  for (const entry of variables ?? variablesCache.values()) {
    const [id, key, variable] = entry

    if (updateCache) {
      variablesCache.add(entry)
    }

    if (cancelled) {
      break
    }

    if (seen.has(id)) {
      continue
    }

    seen.add(id)

    const iterator = iteratorsRecord[key]

    if (iterator === undefined) {
      continue
    }

    iterator.next(variable)
    cancelled = (yield) === true
  }

  const accumulator: StyleSheet[] = []

  if (cancelled) {
    for (const iterator of iteratorsMap.values()) {
      if (iterator !== undefined) {
        iterator.next(true)
      }
    }

    return []
  }

  for (const [key, iterator] of iteratorsMap.entries()) {
    if (iterator !== undefined) {
      const { done, value } = iterator.next(true)

      if (done === true && value !== undefined) {
        Array.isArray(value)
          ? accumulator.push(...value.map((value) => ({ ...value, key })))
          : accumulator.push({ ...value, key })
      }
    }
  }

  return accumulator
}
