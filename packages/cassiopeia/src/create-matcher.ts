import { cacheIterators } from './cache-iterators'
import {
  Matcher,
  Store,
  StyleSheet,
  TypeUpdate,
  Update,
  UpdateSource,
  VariablesCache
} from './types'

export function findLastIndex<T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => boolean
): number {
  let l = array.length
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  while (l--) {
    if (predicate(array[l], l, array)) return l
  }
  return -1
}

export function* createMatcher(log: Update[], store: Store): Matcher {
  const seen = new Set<string>()

  // check if log has source update
  const sourceIndex = findLastIndex(
    log,
    (value) => value.type === TypeUpdate.Source
  )

  const createVariables =
    sourceIndex === -1
      ? undefined
      : (log[sourceIndex] as UpdateSource).createVariables
  const variables =
    createVariables === undefined ? undefined : createVariables()

  // if variables are provided we create a new cache
  const variablesCache: VariablesCache | undefined =
    variables === undefined ? undefined : new Set()

  // clear the cache before writing a new one
  // if (updateVariablesCache) {
  //   variablesCache.clear()
  // }

  let cancelled = false

  // const pluginsWithUpdates = new Set<number>()
  //
  // log.reduce<Set<number>>((acc, update) => {
  //   if (update.type === TypeUpdate.Plugin) {
  //     acc.add(update.index)
  //   }
  //
  //   return acc
  // }, pluginsWithUpdates)

  const iterators = cacheIterators(store.iterators)

  // iterate over variables
  for (const entry of variables ?? store.variablesCache.values()) {
    const [id, name, variable] = entry

    // update the cache if we are going over a new source
    if (variablesCache !== undefined) {
      variablesCache.add(entry)
    }

    if (cancelled) {
      break
    }

    // deduplicate
    if (seen.has(id)) {
      continue
    }

    seen.add(id)

    const iterator = iterators.get(name)

    if (iterator === undefined) {
      continue
    }

    // If the plugin associated with the name/iterator has updates
    // yes: update all variables associated with the name/iterator
    // no:
    // (1) filter old variables from the new variables
    // (2) pass on the new variables
    // (3) prepend the old accumulator to the new one

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
        // Update
        Array.isArray(value)
          ? accumulator.push(
              ...value.map((value) => ({ key: 0, ...value, name }))
            )
          : accumulator.push({ key: 0, ...value, name })
      }
    }
  }

  return { accumulator, variablesCache }
}
