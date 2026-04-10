import { describe, it, expect } from 'vitest'
import { createCassiopeia, CassiopeiaScopes } from './'

describe('CassiopeiaScopes', () => {
  const cassiopeia = createCassiopeia()

  it('deduplicates values across multiple subsets', () => {
    const aggregate = new CassiopeiaScopes(cassiopeia)
    const subset1 = aggregate.createScope()
    const subset2 = aggregate.createScope()

    subset1.add('a')
    subset2.add('a')
    subset1.add('b')

    expect(Object.keys(aggregate.index)).toEqual(expect.arrayContaining(['a', 'b']))
    expect(Object.keys(aggregate.index)).toHaveLength(2)
  })

  it('preserves values when deleted from one subset but held by another', () => {
    const aggregate = new CassiopeiaScopes(cassiopeia)
    const subset1 = aggregate.createScope()
    const subset2 = aggregate.createScope()

    subset1.add('a')
    subset2.add('a')

    expect(subset1.delete('a')).toBe(false)
    expect(Object.keys(aggregate.index)).toEqual(['a'])
  })

  it('removes values from iteration when deleted from all subsets', () => {
    const aggregate = new CassiopeiaScopes(cassiopeia)
    const subset1 = aggregate.createScope()
    const subset2 = aggregate.createScope()

    subset1.add('a')
    subset2.add('a')

    subset1.delete('a')
    expect(subset2.delete('a')).toBe(true)
    expect(Object.keys(aggregate.index)).toEqual([])
  })

  it('handles clear() correctly', () => {
    const aggregate = new CassiopeiaScopes(cassiopeia)
    const subset1 = aggregate.createScope()
    const subset2 = aggregate.createScope()

    subset1.add('a')
    subset1.add('b')
    subset2.add('a')

    expect(subset1.clear()).toBe(true)
    expect(Object.keys(aggregate.index)).toEqual(['a'])
  })

  it('handles subset disposal', () => {
    const aggregate = new CassiopeiaScopes(cassiopeia)
    const subset1 = aggregate.createScope()
    const subset2 = aggregate.createScope()

    subset1.add('a')
    subset1.add('b')
    subset2.add('a')

    expect(subset1.dispose()).toBe(true)

    expect(Object.keys(aggregate.index)).toEqual(['a'])
    expect(() => subset1.add('c')).toThrow(/Cannot read properties of undefined/i)
    expect(() => subset1.delete('c')).toThrow(/Cannot read properties of undefined/i)
  })

  it('handles aggregate disposal', () => {
    const aggregate = new CassiopeiaScopes(cassiopeia)
    const subset1 = aggregate.createScope()
    const subset2 = aggregate.createScope()

    subset1.add('a')
    subset2.add('b')

    aggregate.dispose()

    expect(Object.keys(aggregate.index)).toEqual([])

    const subset3 = aggregate.createScope()
    subset3.add('c')
    expect(Object.keys(aggregate.index)).toEqual(['c'])
  })

  it('returns correct boolean values for add operations', () => {
    const aggregate = new CassiopeiaScopes(cassiopeia)
    const subset1 = aggregate.createScope()
    const subset2 = aggregate.createScope()

    expect(subset1.add('a')).toBe(true)
    expect(subset1.add('a')).toBe(false)
    expect(subset2.add('a')).toBe(false)
  })

  it('handles empty aggregate iteration', () => {
    const aggregate = new CassiopeiaScopes(cassiopeia)
    expect(Object.keys(aggregate.index)).toEqual([])
  })

  describe('addMany', () => {
    it('adds multiple values and returns true if any were new to index', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset = aggregate.createScope()

      expect(subset.addMany(['a', 'b', 'c'])).toBe(true)
      expect(Object.keys(aggregate.index)).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    })

    it('returns false when all values already exist in subset', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset = aggregate.createScope()

      subset.addMany(['a', 'b'])
      expect(subset.addMany(['a', 'b'])).toBe(false)
    })

    it('returns false when values exist in other subsets', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset1 = aggregate.createScope()
      const subset2 = aggregate.createScope()

      subset1.addMany(['a', 'b'])
      expect(subset2.addMany(['a', 'b'])).toBe(false)
    })

    it('returns true when at least one value is new to index', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset1 = aggregate.createScope()
      const subset2 = aggregate.createScope()

      subset1.add('a')
      expect(subset2.addMany(['a', 'b', 'c'])).toBe(true)
    })

    it('handles empty iterable', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset = aggregate.createScope()

      expect(subset.addMany([])).toBe(false)
    })
  })

  describe('deleteMany', () => {
    it('deletes multiple values and returns true if any were removed from index', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset = aggregate.createScope()

      subset.addMany(['a', 'b', 'c'])
      expect(subset.deleteMany(['a', 'b'])).toBe(true)
      expect(Object.keys(aggregate.index)).toEqual(['c'])
    })

    it('returns false when values do not exist in subset', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset = aggregate.createScope()

      subset.add('a')
      expect(subset.deleteMany(['b', 'c'])).toBe(false)
    })

    it('returns false when values exist in other subsets', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset1 = aggregate.createScope()
      const subset2 = aggregate.createScope()

      subset1.addMany(['a', 'b'])
      subset2.addMany(['a', 'b'])

      expect(subset1.deleteMany(['a', 'b'])).toBe(false)
      expect(Object.keys(aggregate.index)).toEqual(expect.arrayContaining(['a', 'b']))
    })

    it('returns true when at least one value is removed from index', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset1 = aggregate.createScope()
      const subset2 = aggregate.createScope()

      subset1.addMany(['a', 'b', 'c'])
      subset2.add('a')

      expect(subset1.deleteMany(['a', 'b', 'c'])).toBe(true)
      expect(Object.keys(aggregate.index)).toEqual(['a'])
    })

    it('handles empty iterable', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset = aggregate.createScope()

      expect(subset.deleteMany([])).toBe(false)
    })
  })

  describe('boolean return values', () => {
    it('add returns true only when adding to index', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const s1 = aggregate.createScope()
      const s2 = aggregate.createScope()

      expect(s1.add('x')).toBe(true)
      expect(s1.add('x')).toBe(false)
      expect(s2.add('x')).toBe(false)
    })

    it('delete returns true only when removing from index', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const s1 = aggregate.createScope()
      const s2 = aggregate.createScope()

      s1.add('x')
      s2.add('x')

      expect(s1.delete('x')).toBe(false)
      expect(s2.delete('x')).toBe(true)
      expect(s1.delete('y')).toBe(false)
    })

    it('clear returns true only when removing from index', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const s1 = aggregate.createScope()
      const s2 = aggregate.createScope()

      s1.addMany(['a', 'b'])
      s2.add('a')

      expect(s1.clear()).toBe(true)
      expect(s2.clear()).toBe(true)
      expect(s1.clear()).toBe(false)
    })

    it('dispose returns true only when removing from index', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const s1 = aggregate.createScope()
      const s2 = aggregate.createScope()

      s1.add('x')
      s2.add('x')

      expect(s1.dispose()).toBe(false)
      expect(s2.dispose()).toBe(true)
    })

    it('dispose returns false when called on already disposed subset', () => {
      const aggregate = new CassiopeiaScopes(cassiopeia)
      const subset = aggregate.createScope()

      subset.add('x')
      expect(subset.dispose()).toBe(true)
      expect(subset.dispose()).toBe(false)
    })
  })
})
