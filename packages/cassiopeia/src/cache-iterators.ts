import { Iterator, Iterators } from './types'

type RecordsValue = Iterator | undefined

export const cacheIterators = (values: Iterators) => {
  const records: Record<string, RecordsValue> = {}
  const cache: Map<string, Iterator | undefined> = new Map()

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
    get: (key: string): RecordsValue => records[key],
    values: () => cache.values(),
    entries: () => cache.entries()
  }
}
