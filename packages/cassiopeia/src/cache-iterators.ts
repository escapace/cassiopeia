import { Iterator, Iterators } from './types'

export const cacheIterators = (array: Iterators[]) => {
  const records: Record<string, Iterator | undefined> = {}
  const cache: Map<string, Iterator | undefined> = new Map()

  array.forEach((values) => {
    for (const key of values.keys()) {
      Object.defineProperty(records, key, {
        get(): Iterator | undefined {
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
  })

  return {
    get: (key: string) => records[key],
    values: () => cache.values(),
    entries: () => cache.entries()
  }
}
