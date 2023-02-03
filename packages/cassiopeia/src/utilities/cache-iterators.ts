import type { Iterator, Iterators } from '../types'

export const cacheIterators = (values: Iterators) => {
  const object: Record<string, Iterator> = {}
  const cache: Map<string, Iterator | undefined> = new Map()

  for (const key of values.keys()) {
    Object.defineProperty(object, key, {
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

  return [object, cache] as const
}
