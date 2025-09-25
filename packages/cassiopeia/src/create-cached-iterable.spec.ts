/* eslint-disable unicorn/consistent-function-scoping */
// createCachedIterable.spec.ts
import { describe, expect, it, vi } from 'vitest'
import { createCachedIterable } from './create-cached-iterable'
import { TERMINATING_REDUCER_CANCEL } from './create-terminating-reducers'

describe('createCachedIterable', () => {
  it('is lazy and does not call the factory until first consumption', () => {
    const factoryFunction = vi.fn(() => [1, 2, 3])
    const cached = createCachedIterable(factoryFunction)

    expect(factoryFunction).toHaveBeenCalledTimes(0)

    const iterator = cached[Symbol.iterator]()
    expect(factoryFunction).toHaveBeenCalledTimes(0)

    const first = iterator.next()
    expect(first).toEqual({ done: false, value: 1 })
    expect(factoryFunction).toHaveBeenCalledTimes(1)
  })

  it('calls the factory once and caches values across multiple full iterations', () => {
    const yieldSpy = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3)

    function* makeNumbers() {
      yield yieldSpy()
      yield yieldSpy()
      yield yieldSpy()
      return 99
    }

    const factoryFunction = vi.fn(() => makeNumbers())
    const cached = createCachedIterable(factoryFunction)

    const a = [...cached]
    expect(yieldSpy).toHaveBeenCalledTimes(3)

    const b = Array.from(cached)
    expect(yieldSpy).toHaveBeenCalledTimes(3) // no additional calls, using cache

    expect(a).toEqual([1, 2, 3])
    expect(b).toEqual([1, 2, 3])
    expect(factoryFunction).toHaveBeenCalledTimes(1)
  })

  it('replays cached prefix and then extends cache after a partial pass', () => {
    const yieldSpy = vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3)

    function* makeNumbers() {
      yield yieldSpy()
      yield yieldSpy()
      yield yieldSpy()
    }

    const factoryFunction = vi.fn(() => makeNumbers())
    const cached = createCachedIterable(factoryFunction)

    const iteratorOne = cached[Symbol.iterator]()
    expect(iteratorOne.next()).toEqual({ done: false, value: 1 })
    expect(yieldSpy).toHaveBeenCalledTimes(1)
    // stop early, only value 1 is cached so far

    const seenSecond = [...cached]
    expect(yieldSpy).toHaveBeenCalledTimes(3) // extends cache with 2 and 3
    expect(seenSecond).toEqual([1, 2, 3])
    expect(factoryFunction).toHaveBeenCalledTimes(1)

    const seenThird = Array.from(cached)
    expect(yieldSpy).toHaveBeenCalledTimes(3) // no additional calls, using cache
    expect(seenThird).toEqual([1, 2, 3])
    expect(factoryFunction).toHaveBeenCalledTimes(1)
  })

  it('supports interleaved iterators with shared cache and single source', () => {
    const yieldSpy = vi
      .fn()
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(4)
      .mockReturnValue('NEVER')

    function* makeNumbers() {
      yield yieldSpy()
      yield yieldSpy()
      yield yieldSpy()
      yield yieldSpy()
    }

    const factoryFunction = vi.fn(() => makeNumbers())
    const cached = createCachedIterable(factoryFunction)

    const iteratorA = cached[Symbol.iterator]()
    const iteratorB = cached[Symbol.iterator]()

    expect(iteratorA.next()).toEqual({ done: false, value: 1 }) // caches 1
    expect(yieldSpy).toHaveBeenCalledTimes(1)
    expect(iteratorA.next()).toEqual({ done: false, value: 2 }) // caches 2
    expect(yieldSpy).toHaveBeenCalledTimes(2)

    expect(iteratorB.next()).toEqual({ done: false, value: 1 }) // from cache
    expect(yieldSpy).toHaveBeenCalledTimes(2) // no additional calls
    expect(iteratorB.next()).toEqual({ done: false, value: 2 }) // from cache
    expect(yieldSpy).toHaveBeenCalledTimes(2) // no additional calls

    expect(iteratorB.next()).toEqual({ done: false, value: 3 }) // extends cache
    expect(yieldSpy).toHaveBeenCalledTimes(3)
    expect(iteratorA.next()).toEqual({ done: false, value: 3 }) // from cache
    expect(yieldSpy).toHaveBeenCalledTimes(3) // no additional calls

    expect(iteratorA.next()).toEqual({ done: false, value: 4 }) // extends cache
    expect(yieldSpy).toHaveBeenCalledTimes(4)
    expect(iteratorB.next()).toEqual({ done: false, value: 4 }) // from cache
    expect(yieldSpy).toHaveBeenCalledTimes(4) // no additional calls

    expect(factoryFunction).toHaveBeenCalledTimes(1)
  })

  it('surfaces source return value when completing', () => {
    function* makeNumbers() {
      yield 1
      yield 2
      return 42
    }

    const cached = createCachedIterable(() => makeNumbers())
    const iterator = cached[Symbol.iterator]()

    expect(iterator.next()).toEqual({ done: false, value: 1 })
    expect(iterator.next()).toEqual({ done: false, value: 2 })

    const finalStep = iterator.next()
    expect(finalStep.done).toBe(true)
    expect(finalStep.value).toBe(42)

    const finalFinalStep = iterator.next()
    expect(finalFinalStep.done).toBe(true)
    expect(finalFinalStep.value).toBe(undefined)

    const again = Array.from(cached)
    expect(again).toEqual([1, 2])
  })

  it('propagates errors and preserves cache of values observed before the error', () => {
    function* makeThenThrow() {
      yield 'a'
      yield 'b'
      throw new Error('boom')
    }

    const cached = createCachedIterable(() => makeThenThrow())

    const iteratorOne = cached[Symbol.iterator]()
    expect(iteratorOne.next()).toEqual({ done: false, value: 'a' })
    expect(iteratorOne.next()).toEqual({ done: false, value: 'b' })

    expect(() => iteratorOne.next()).toThrowError()

    const iteratorTwo = cached[Symbol.iterator]()
    expect(iteratorTwo.next()).toEqual({ done: false, value: 'a' })
    expect(iteratorTwo.next()).toEqual({ done: false, value: 'b' })
    expect(iteratorTwo.next()).toEqual({ done: true, value: undefined })
  })

  it('throws a TypeError when factory returns a non-iterable at first consumption', () => {
    // @ts-expect-error intentional misuse for runtime check
    const cached = createCachedIterable(() => undefined)
    const iterator = cached[Symbol.iterator]()
    expect(() => iterator.next()).toThrowError()
  })

  it('does not forward regular inputs to source', () => {
    function* expectInput() {
      const received: unknown = (yield 'prompt') ?? 'ok'
      yield received
    }

    const cached = createCachedIterable(() => expectInput())

    const iterator = cached[Symbol.iterator]()
    const first = iterator.next()
    expect(first).toEqual({ done: false, value: 'prompt' })

    // @ts-expect-error testing
    const second = iterator.next('value from consumer')
    // The wrapper does not forward inputs to the source, so received is ok
    expect(second).toEqual({ done: false, value: 'ok' })

    const doneStep = iterator.next()
    expect(doneStep.done).toBe(true)

    const again = Array.from(cached)
    expect(again).toEqual(['prompt', 'ok'])
  })

  it('terminates early during source reading', () => {
    const yieldSpy = vi
      .fn()
      .mockReturnValueOnce('first')
      .mockReturnValueOnce('second')
      .mockReturnValueOnce('third')
      .mockReturnValue('NEVER')

    function* makeValues() {
      yield yieldSpy()
      yield yieldSpy()
      yield yieldSpy()
    }

    const cached = createCachedIterable(() => makeValues())

    const iterator = cached[Symbol.iterator]()
    const first = iterator.next()
    expect(first).toEqual({ done: false, value: 'first' })
    expect(yieldSpy).toHaveBeenCalledTimes(1)

    // Pass TERMINATING_REDUCER_CANCEL to terminate early
    const cancelled = iterator.next(TERMINATING_REDUCER_CANCEL)
    expect(cancelled.done).toBe(true)
    expect(cancelled.value).toBe(undefined)
    expect(yieldSpy).toHaveBeenCalledTimes(2)

    const newIterator = cached[Symbol.iterator]()
    expect(newIterator.next()).toEqual({ done: true, value: undefined })

    expect(yieldSpy).toHaveBeenCalledTimes(2)
  })

  it('forwards cancellation to source generator that handles TERMINATING_REDUCER_CANCEL appropriately', () => {
    const yieldSpy = vi
      .fn()
      .mockReturnValueOnce('value1')
      .mockReturnValueOnce('value2')
      .mockReturnValueOnce('value3')
      .mockReturnValue('NEVER')

    function* makeValues() {
      let input: unknown = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return

      input = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return

      input = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return
    }

    const cached = createCachedIterable(() => makeValues())

    const iterator = cached[Symbol.iterator]()
    const first = iterator.next()
    expect(first).toEqual({ done: false, value: 'value1' })
    expect(yieldSpy).toHaveBeenCalledTimes(1)

    // Pass TERMINATING_REDUCER_CANCEL - should be handled by source generator
    const cancelled = iterator.next(TERMINATING_REDUCER_CANCEL)
    expect(cancelled.done).toBe(true)
    expect(cancelled.value).toBe(undefined)
    expect(yieldSpy).toHaveBeenCalledTimes(1) // no additional calls

    const newIterator = cached[Symbol.iterator]()
    expect(newIterator.next()).toEqual({ done: true, value: undefined })

    expect(yieldSpy).toHaveBeenCalledTimes(1) // no additional calls
  })

  it('handles cancellation during cache reading when source already complete', () => {
    const yieldSpy = vi
      .fn()
      .mockReturnValueOnce('alpha')
      .mockReturnValueOnce('beta')
      .mockReturnValueOnce('gamma')
      .mockReturnValue('NEVER')

    function* makeValues() {
      yield yieldSpy()
      yield yieldSpy()
      yield yieldSpy()
    }

    const cached = createCachedIterable(() => makeValues())

    // First iterator: consume all values to populate cache
    const firstIterator = cached[Symbol.iterator]()
    expect(firstIterator.next()).toEqual({ done: false, value: 'alpha' })
    expect(firstIterator.next()).toEqual({ done: false, value: 'beta' })
    expect(firstIterator.next()).toEqual({ done: false, value: 'gamma' })
    expect(firstIterator.next().done).toBe(true)
    expect(yieldSpy).toHaveBeenCalledTimes(3)

    // Second iterator: cancel while reading from cache
    const secondIterator = cached[Symbol.iterator]()
    expect(secondIterator.next()).toEqual({ done: false, value: 'alpha' })
    expect(yieldSpy).toHaveBeenCalledTimes(3) // no additional calls, from cache

    // Cancel during cache reading
    const cancelled = secondIterator.next(TERMINATING_REDUCER_CANCEL)

    expect(cancelled.done).toBe(true)
    expect(cancelled.value).toBe(undefined)
    expect(yieldSpy).toHaveBeenCalledTimes(3) // still no additional calls

    const thirdIterator = cached[Symbol.iterator]()
    expect(thirdIterator.next()).toEqual({ done: true, value: undefined })
    expect(yieldSpy).toHaveBeenCalledTimes(3) // still no additional calls
  })

  it('cancels via method during active iteration with cancellation behavior', () => {
    const yieldSpy = vi
      .fn()
      .mockReturnValueOnce('alpha')
      .mockReturnValueOnce('beta')
      .mockReturnValueOnce('gamma')
      .mockReturnValueOnce('delta')
      .mockReturnValueOnce('epsilon')
      .mockReturnValueOnce('zeta')
      .mockReturnValue('NEVER')

    function* makeValues() {
      let input: unknown = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return

      input = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return

      input = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return
    }

    const cached = createCachedIterable(() => makeValues())

    // Start active iteration
    const iterator = cached[Symbol.iterator]()
    expect(iterator.next()).toEqual({ done: false, value: 'alpha' })
    expect(yieldSpy).toHaveBeenCalledTimes(1)

    // Cancel via method call
    cached[TERMINATING_REDUCER_CANCEL]()
    expect(yieldSpy).toHaveBeenCalledTimes(1)

    const nextFromActiveIterator = iterator.next()
    expect(nextFromActiveIterator.done).toBe(true) // gracefully completes
    expect(nextFromActiveIterator.value).toBe(undefined)

    const newIterator = cached[Symbol.iterator]()
    expect(newIterator.next()).toEqual({ done: true, value: undefined })

    // Verify method is idempotent (safe to call multiple times)
    cached[TERMINATING_REDUCER_CANCEL]()
    cached[TERMINATING_REDUCER_CANCEL]()
    expect(yieldSpy).toHaveBeenCalledTimes(1) // no additional calls from idempotent cancellations
  })

  it('cancels via method before any iteration starts with cancellation behavior', () => {
    const yieldSpy = vi
      .fn()
      .mockReturnValueOnce('value1')
      .mockReturnValueOnce('value2')
      .mockReturnValueOnce('value3')
      .mockReturnValue('NEVER')

    const factorySpy = vi.fn().mockImplementation(() => {
      function* makeValues() {
        yield yieldSpy()
        yield yieldSpy()
        yield yieldSpy()
      }
      return makeValues()
    })

    const cached = createCachedIterable(factorySpy)

    // Cancel before any iteration begins
    expect(factorySpy).toHaveBeenCalledTimes(0) // factory not called yet
    expect(yieldSpy).toHaveBeenCalledTimes(0) // no source calls yet

    cached[TERMINATING_REDUCER_CANCEL]()

    expect(factorySpy).toHaveBeenCalledTimes(0) // factory still not called until needed
    expect(yieldSpy).toHaveBeenCalledTimes(0) // no source calls yet

    const iterator = cached[Symbol.iterator]()
    const result = iterator.next()
    expect(result.done).toBe(true)

    expect(factorySpy).toHaveBeenCalledTimes(0)
    expect(yieldSpy).toHaveBeenCalledTimes(0)
  })

  it('demonstrates cooperative cache extension with multiple iterators working together', () => {
    const yieldSpy = vi
      .fn()
      .mockReturnValueOnce('item-1')
      .mockReturnValueOnce('item-2')
      .mockReturnValueOnce('item-3')
      .mockReturnValueOnce('item-4')
      .mockReturnValueOnce('item-5')
      .mockReturnValue('NEVER')

    function* makeItems() {
      let input: unknown = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return

      input = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return

      input = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return

      input = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return

      input = yield yieldSpy()
      if (input === TERMINATING_REDUCER_CANCEL) return
    }

    const cached = createCachedIterable(() => makeItems())

    // Create three iterators that will work cooperatively
    const iteratorA = cached[Symbol.iterator]()
    const iteratorB = cached[Symbol.iterator]()
    const iteratorC = cached[Symbol.iterator]()

    // Iterator A extends cache to get first item
    expect(iteratorA.next()).toEqual({ done: false, value: 'item-1' })
    expect(yieldSpy).toHaveBeenCalledTimes(1)

    // Iterator B reads from cache (no extension needed)
    expect(iteratorB.next()).toEqual({ done: false, value: 'item-1' })
    expect(yieldSpy).toHaveBeenCalledTimes(1) // no additional calls

    // Iterator A extends cache for second item
    expect(iteratorA.next()).toEqual({ done: false, value: 'item-2' })
    expect(yieldSpy).toHaveBeenCalledTimes(2)

    // Iterator C reads both cached items
    expect(iteratorC.next()).toEqual({ done: false, value: 'item-1' }) // from cache
    expect(iteratorC.next()).toEqual({ done: false, value: 'item-2' }) // from cache
    expect(yieldSpy).toHaveBeenCalledTimes(2) // no additional calls

    // Iterator B extends cache for third item
    expect(iteratorB.next()).toEqual({ done: false, value: 'item-2' }) // from cache
    expect(iteratorB.next()).toEqual({ done: false, value: 'item-3' }) // extends cache
    expect(yieldSpy).toHaveBeenCalledTimes(3)

    // Iterator C extends cache for fourth item
    expect(iteratorC.next()).toEqual({ done: false, value: 'item-3' }) // from cache
    expect(iteratorC.next()).toEqual({ done: false, value: 'item-4' }) // extends cache
    expect(yieldSpy).toHaveBeenCalledTimes(4)

    // All iterators can now read the cooperatively-built cache
    expect(iteratorA.next()).toEqual({ done: false, value: 'item-3' }) // from cache
    expect(iteratorA.next()).toEqual({ done: false, value: 'item-4' }) // from cache
    expect(iteratorB.next()).toEqual({ done: false, value: 'item-4' }) // from cache
    expect(yieldSpy).toHaveBeenCalledTimes(4) // no additional calls

    // Verify the cache contains all cooperatively-extended values
    const fullCache = Array.from(cached)
    expect(fullCache).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5'])
    expect(yieldSpy).toHaveBeenCalledTimes(5) // one final call to complete the cache

    expect(iteratorA.next()).toEqual({ done: false, value: 'item-5' }) // from cache
    expect(iteratorA.next()).toEqual({ done: true, value: undefined })

    expect(iteratorB.next()).toEqual({ done: false, value: 'item-5' }) // from cache
    expect(iteratorB.next()).toEqual({ done: true, value: undefined })

    const iteratorD = cached[Symbol.iterator]()

    expect(iteratorD.next()).toEqual({ done: false, value: 'item-1' }) // from cache
    expect(iteratorD.next()).toEqual({ done: false, value: 'item-2' }) // from cache
    expect(iteratorD.next()).toEqual({ done: false, value: 'item-3' }) // from cache
    expect(iteratorD.next()).toEqual({ done: false, value: 'item-4' }) // from cache
    expect(iteratorD.next()).toEqual({ done: false, value: 'item-5' }) // from cache
    expect(iteratorD.next()).toEqual({ done: true, value: undefined })
  })

  it.each([{ option: 'method-based' }, { option: 'iterator-based' }] as const)(
    'forces active iterators to complete gracefully immediately after source clearing via $option cancellation',
    ({ option }) => {
      const yieldSpy = vi
        .fn()
        .mockReturnValueOnce('alpha')
        .mockReturnValueOnce('beta')
        .mockReturnValueOnce('gamma')
        .mockReturnValueOnce('delta')
        .mockReturnValue('NEVER')

      function* makeValues() {
        let input: unknown = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return
      }

      const cached = createCachedIterable(() => makeValues())

      // Create iterator and consume first value to establish active source
      const iterator = cached[Symbol.iterator]()
      expect(iterator.next()).toEqual({ done: false, value: 'alpha' })
      expect(yieldSpy).toHaveBeenCalledTimes(1)

      if (option === 'method-based') {
        // Cancel via method while iterator is active - clears source immediately
        cached[TERMINATING_REDUCER_CANCEL]()
      } else {
        iterator.next(TERMINATING_REDUCER_CANCEL)
      }

      // Active iterator should complete gracefully on next call without extending cache
      // since it has used source before but source was cleared
      const result = iterator.next()
      expect(result.done).toBe(true) // graceful completion immediately
      expect(result.value).toBe(undefined)

      // Verify the iterator continues to be done on subsequent calls
      const finalResult = iterator.next()
      expect(finalResult.done).toBe(true)
      expect(finalResult.value).toBe(undefined)

      expect(yieldSpy).toHaveBeenCalledTimes(1)

      const newIterator = cached[Symbol.iterator]()
      expect(newIterator.next()).toEqual({ done: true, value: undefined })
      expect(yieldSpy).toHaveBeenCalledTimes(1)

      expect(newIterator.next()).toEqual({ done: true, value: undefined })
    },
  )

  it.each([{ option: 'method-based' }, { option: 'iterator-based' }] as const)(
    'handles $option cancellation during cache reading phase',
    ({ option }) => {
      const yieldSpy = vi
        .fn()
        .mockReturnValueOnce('cached-1')
        .mockReturnValueOnce('cached-2')
        .mockReturnValueOnce('cached-3')
        .mockReturnValueOnce('new-4')
        .mockReturnValueOnce('new-5')
        .mockReturnValue('NEVER')

      function* makeValues() {
        let input: unknown = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return
      }

      const cached = createCachedIterable(() => makeValues())

      // First iterator: populate cache with several values
      const firstIterator = cached[Symbol.iterator]()
      expect(firstIterator.next()).toEqual({ done: false, value: 'cached-1' })
      expect(firstIterator.next()).toEqual({ done: false, value: 'cached-2' })
      expect(firstIterator.next()).toEqual({ done: false, value: 'cached-3' })
      expect(yieldSpy).toHaveBeenCalledTimes(3)

      // Second iterator: start reading from cache
      const secondIterator = cached[Symbol.iterator]()
      expect(secondIterator.next()).toEqual({ done: false, value: 'cached-1' }) // from cache
      expect(yieldSpy).toHaveBeenCalledTimes(3) // no additional calls

      const thirdIterator = cached[Symbol.iterator]()
      expect(thirdIterator.next()).toEqual({ done: false, value: 'cached-1' }) // from cache
      expect(yieldSpy).toHaveBeenCalledTimes(3) // no additional calls

      // Cancel via while iterator is reading from cache
      if (option === 'method-based') {
        cached[TERMINATING_REDUCER_CANCEL]()
      } else {
        secondIterator.next(TERMINATING_REDUCER_CANCEL)
      }

      // Existing iterator should complete immediately
      expect(secondIterator.next()).toEqual({ done: true, value: undefined })
      expect(yieldSpy).toHaveBeenCalledTimes(3) // no additional calls

      const fourthIterator = cached[Symbol.iterator]()
      expect(fourthIterator.next()).toEqual({ done: true, value: undefined })
      expect(yieldSpy).toHaveBeenCalledTimes(3) // no additional calls

      expect(thirdIterator.next()).toEqual({ done: true, value: undefined })
      expect(yieldSpy).toHaveBeenCalledTimes(3) // still no additional calls

      // Verify iterator stays done
      expect(secondIterator.next()).toEqual({ done: true, value: undefined })
      expect(yieldSpy).toHaveBeenCalledTimes(3) // still no additional calls
    },
  )

  it.each([{ option: 'method-based' }, { option: 'iterator-based' }] as const)(
    'handles $option cancellation before any iteration starts',
    ({ option }) => {
      const yieldSpy = vi
        .fn()
        .mockReturnValueOnce('alpha')
        .mockReturnValueOnce('beta')
        .mockReturnValueOnce('gamma')
        .mockReturnValueOnce('delta')
        .mockReturnValueOnce('epsilon')
        .mockReturnValue('NEVER')

      function* makeValues() {
        let input: unknown = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return

        input = yield yieldSpy()
        if (input === TERMINATING_REDUCER_CANCEL) return
      }

      const cached = createCachedIterable(() => makeValues())

      const firstIterator = cached[Symbol.iterator]()
      const secondIterator = cached[Symbol.iterator]()

      if (option === 'method-based') {
        cached[TERMINATING_REDUCER_CANCEL]()
        expect(yieldSpy).toHaveBeenCalledTimes(0)
      } else {
        firstIterator.next(TERMINATING_REDUCER_CANCEL)
        expect(yieldSpy).toHaveBeenCalledTimes(0)
      }

      // Existing iterator should complete immediately
      expect(secondIterator.next()).toEqual({ done: true, value: undefined })
      expect(firstIterator.next()).toEqual({ done: true, value: undefined })
    },
  )
})
