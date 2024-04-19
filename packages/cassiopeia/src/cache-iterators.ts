import type { Iterator, Iterators } from './types'

type RecordsValue = Iterator | undefined

export const cacheIterators = (values: Iterators) => {
  const records: Record<string, RecordsValue> = {}
  const cache = new Map<string, Iterator | undefined>()

  for (const key of values.keys()) {
    Object.defineProperty(records, key, {
      get(): RecordsValue {
        if (cache.has(key)) {
          return cache.get(key)
        }

        const value = values.get(key)

        if (value === undefined) {
          cache.set(key, undefined)
          return
        }

        const generator = value()

        // A value passed to the first invocation of next() is always ignored.
        generator.next()

        cache.set(key, generator)

        return generator
      }
    })
  }

  return {
    entries: () => cache.entries(),
    get: (key: string): RecordsValue => records[key],
    values: () => cache.values()
  }
}
