import type { Iterators, Matcher, Variables, VariablesCache } from '../types'
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

  if (cancelled) {
    for (const iterator of iteratorsMap.values()) {
      if (iterator !== undefined) {
        iterator.next(true)
      }
    }

    return
  }

  let accumulator = ''

  for (const iterator of iteratorsMap.values()) {
    if (iterator !== undefined) {
      const { done, value } = iterator.next(true)

      if (done === true && value !== undefined) {
        accumulator += value
      }
    }
  }

  if (accumulator.length === 0) {
    return undefined
  }

  return accumulator
}
