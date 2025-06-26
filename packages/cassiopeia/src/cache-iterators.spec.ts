import { assert, describe, expect, it, vi } from 'vitest'
import { cacheIterators } from './cache-iterators'
import type { Iterator, Iterators, StyleSheetPartial } from './types'

function* createSimpleIterator(
  result: StyleSheetPartial | StyleSheetPartial[] | undefined,
): Iterator {
  let cursor: string | true

  while ((cursor = yield) !== true) {
    assert(typeof cursor === 'string')
    // Process input if needed
  }

  return result
}

function* createMultiYieldIterator(): Iterator {
  let cursor: string | true
  let count = 0

  while ((cursor = yield) !== true) {
    assert(typeof cursor === 'string')

    count++
    if (count >= 2) break
  }

  return { content: 'test-content' }
}

describe('cacheIterators', () => {
  describe('basic functionality', () => {
    it('should create a cache with get, entries, and values methods', () => {
      const iterators: Iterators = {}
      const cache = cacheIterators(iterators)

      expect(cache).toHaveProperty('get')
      expect(cache).toHaveProperty('entries')
      expect(cache).toHaveProperty('values')
      expect(typeof cache.get).toBe('function')
      expect(typeof cache.entries).toBe('function')
      expect(typeof cache.values).toBe('function')
    })

    it('should return undefined for non-existent keys', () => {
      const iterators: Iterators = {}
      const cache = cacheIterators(iterators)

      expect(cache.get('nonexistent')).toBeUndefined()
    })
  })

  describe('iterator caching', () => {
    it('should cache iterators after first access', () => {
      const mockIteratorFactory = vi.fn(() => createSimpleIterator({ content: 'test' }))
      const iterators: Iterators = {
        test: mockIteratorFactory,
      }
      const cache = cacheIterators(iterators)

      const firstAccess = cache.get('test')
      const secondAccess = cache.get('test')

      expect(mockIteratorFactory).toHaveBeenCalledTimes(1)
      expect(firstAccess).toBe(secondAccess)
    })

    it('should call next() once on iterator creation to skip first value', () => {
      const mockIterator = createSimpleIterator({ content: 'test' })
      const nextSpy = vi.spyOn(mockIterator, 'next')
      const mockIteratorFactory = vi.fn(() => mockIterator)

      const iterators: Iterators = {
        test: mockIteratorFactory,
      }
      const cache = cacheIterators(iterators)

      cache.get('test')

      expect(nextSpy).toHaveBeenCalledTimes(1)
      expect(nextSpy).toHaveBeenCalledWith()
    })

    it('should handle undefined iterator factories', () => {
      const iterators: Iterators = {
        // @ts-expect-error undefined
        test: undefined,
      }
      const cache = cacheIterators(iterators)

      expect(cache.get('test')).toBeUndefined()
    })

    it('should cache undefined values', () => {
      const iterators: Iterators = {
        // @ts-expect-error undefined
        test: undefined,
      }
      const cache = cacheIterators(iterators)

      const firstAccess = cache.get('test')
      const secondAccess = cache.get('test')

      expect(firstAccess).toBeUndefined()
      expect(secondAccess).toBeUndefined()
    })
  })

  describe('entries method', () => {
    it('should return empty array when no iterators accessed', () => {
      const iterators: Iterators = {
        test1: () => createSimpleIterator({ content: 'test1' }),
        test2: () => createSimpleIterator({ content: 'test2' }),
      }
      const cache = cacheIterators(iterators)

      expect(cache.entries()).toEqual([])
    })

    it('should return entries for accessed iterators only', () => {
      const iterators: Iterators = {
        test1: () => createSimpleIterator({ content: 'test1' }),
        test2: () => createSimpleIterator({ content: 'test2' }),
      }
      const cache = cacheIterators(iterators)

      cache.get('test1')
      const entries = cache.entries()

      expect(entries).toHaveLength(1)
      expect(entries[0][0]).toBe('test1')
      expect(entries[0][1]).toBeDefined()
    })

    it('should return entries including undefined values', () => {
      const iterators: Iterators = {
        test1: () => createSimpleIterator({ content: 'test1' }),
        // @ts-expect-error undefined
        test2: undefined,
      }
      const cache = cacheIterators(iterators)

      cache.get('test1')
      cache.get('test2')
      const entries = cache.entries()

      expect(entries).toHaveLength(2)
      expect(entries.find(([key]) => key === 'test1')?.[1]).toBeDefined()
      expect(entries.find(([key]) => key === 'test2')?.[1]).toBeUndefined()
    })
  })

  describe('values method', () => {
    it('should return empty array when no iterators accessed', () => {
      const iterators: Iterators = {
        test1: () => createSimpleIterator({ content: 'test1' }),
        test2: () => createSimpleIterator({ content: 'test2' }),
      }
      const cache = cacheIterators(iterators)

      expect(cache.values()).toEqual([])
    })

    it('should return values for accessed iterators only', () => {
      const iterators: Iterators = {
        test1: () => createSimpleIterator({ content: 'test1' }),
        test2: () => createSimpleIterator({ content: 'test2' }),
      }
      const cache = cacheIterators(iterators)

      cache.get('test1')
      const values = cache.values()

      expect(values).toHaveLength(1)
      expect(values[0]).toBeDefined()
    })

    it('should return values including undefined', () => {
      const iterators: Iterators = {
        test1: () => createSimpleIterator({ content: 'test1' }),
        // @ts-expect-error undefined
        test2: undefined,
      }
      const cache = cacheIterators(iterators)

      cache.get('test1')
      cache.get('test2')
      const values = cache.values()

      expect(values).toHaveLength(2)
      expect(values.includes(undefined)).toBe(true)
    })
  })

  describe('lazy evaluation', () => {
    it('should not create iterators until accessed', () => {
      const mockIteratorFactory1 = vi.fn(() => createSimpleIterator({ content: 'test1' }))
      const mockIteratorFactory2 = vi.fn(() => createSimpleIterator({ content: 'test2' }))

      const iterators: Iterators = {
        test1: mockIteratorFactory1,
        test2: mockIteratorFactory2,
      }
      const cache = cacheIterators(iterators)

      expect(mockIteratorFactory1).not.toHaveBeenCalled()
      expect(mockIteratorFactory2).not.toHaveBeenCalled()

      cache.get('test1')

      expect(mockIteratorFactory1).toHaveBeenCalledTimes(1)
      expect(mockIteratorFactory2).not.toHaveBeenCalled()
    })
  })

  describe('property descriptor behavior', () => {
    it('should use getter to access cached values', () => {
      const mockIteratorFactory = vi.fn(() => createSimpleIterator({ content: 'test' }))
      const iterators: Iterators = {
        test: mockIteratorFactory,
      }
      const cache = cacheIterators(iterators)

      cache.get('test')
      cache.get('test')
      cache.get('test')

      expect(mockIteratorFactory).toHaveBeenCalledTimes(1)
    })
  })

  describe('complex iterator scenarios', () => {
    it('should handle iterators that yield multiple times', () => {
      const iterators: Iterators = {
        test: () => createMultiYieldIterator(),
      }
      const cache = cacheIterators(iterators)

      const iterator = cache.get('test')
      expect(iterator).toBeDefined()
    })

    it('should handle iterators returning arrays', () => {
      const iterators: Iterators = {
        test: () => createSimpleIterator([{ content: 'test1' }, { content: 'test2' }]),
      }
      const cache = cacheIterators(iterators)

      const iterator = cache.get('test')
      expect(iterator).toBeDefined()
    })

    it('should handle iterators returning undefined', () => {
      const iterators: Iterators = {
        test: () => createSimpleIterator(undefined),
      }
      const cache = cacheIterators(iterators)

      const iterator = cache.get('test')
      expect(iterator).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty iterators object', () => {
      const iterators: Iterators = {}
      const cache = cacheIterators(iterators)

      expect(cache.entries()).toEqual([])
      expect(cache.values()).toEqual([])
      expect(cache.get('anything')).toBeUndefined()
    })

    it('should handle keys with special characters', () => {
      const iterators: Iterators = {
        'key.with.dots': () => createSimpleIterator({ content: 'dots' }),
        'key with spaces': () => createSimpleIterator({ content: 'spaces' }),
        'special-key': () => createSimpleIterator({ content: 'special' }),
      }
      const cache = cacheIterators(iterators)

      expect(cache.get('special-key')).toBeDefined()
      expect(cache.get('key.with.dots')).toBeDefined()
      expect(cache.get('key with spaces')).toBeDefined()
    })
  })
})
