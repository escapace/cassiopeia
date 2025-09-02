import type { Iterator, Iterators } from './types'

export const cacheIterators = (values: Iterators) => {
  const records: Record<string, Iterator | undefined> = {}
  const cache: Record<string, Iterator | undefined> = {}

  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(records, key, {
      get(): Iterator | undefined {
        const cacheValue = cache[key]
        if (cacheValue !== undefined) {
          return cacheValue
        }

        if (value === undefined) {
          cache[key] = undefined
          return
        }

        const generator = value()

        // A value passed to the first invocation of next() is always ignored.
        generator.next()

        cache[key] = generator

        return generator
      },
    })
  }

  return {
    entries: () => Object.entries(cache),
    get: (key: string): Iterator | undefined => records[key],
    values: () => Object.values(cache),
  }
}
