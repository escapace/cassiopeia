import { describe, expect, it } from 'vitest'
import {
  createTerminatingReducers,
  isTerminatingReducerNotTerminated,
  TERMINATING_REDUCER_CANCEL,
  TERMINATING_REDUCER_COMPLETE,
  type TerminatingReducer,
  type TerminatingReducerNext,
} from './create-terminating-reducers'

describe('createTerminatingReducers', () => {
  describe('basic functionality', () => {
    it('should create lazy getters that return cached instances', () => {
      let factoryCallCount = 0
      const reducers = createTerminatingReducers({
        *test(): TerminatingReducer<string, string> {
          factoryCallCount++
          const results: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            results.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) {
            return undefined
          }

          return 'result'
        },
      })

      expect(factoryCallCount).toBe(0)

      const reducer1 = reducers.test
      expect(factoryCallCount).toBe(1)

      const reducer2 = reducers.test
      expect(factoryCallCount).toBe(1)
      expect(reducer1 === reducer2).toBe(true)
    })

    it('should eager-prime reducers on first access', () => {
      const primeSteps: string[] = []
      const reducers = createTerminatingReducers({
        *test() {
          primeSteps.push('started')
          const results: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            results.push(input)
          }

          primeSteps.push('after-prime')
          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'result'
        },
      })
      expect(primeSteps).toEqual([])

      const reducer = reducers.test
      expect(primeSteps).toEqual(['started'])

      const result = reducer.next(TERMINATING_REDUCER_COMPLETE)
      expect(result.value).toBe('result')
      expect(primeSteps).toEqual(['started', 'after-prime'])
    })

    it('should work with string keys', () => {
      let factoryCallCount = 0
      const reducers = createTerminatingReducers({
        *stringKey() {
          factoryCallCount++
          const results: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            results.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'string result'
        },
      })
      expect(factoryCallCount).toBe(0)

      expect(reducers.stringKey.next(TERMINATING_REDUCER_COMPLETE).value).toBe('string result')
      expect(factoryCallCount).toBe(1)
    })

    it('should work with number keys', () => {
      let factoryCallCount = 0
      const reducers = createTerminatingReducers({
        *42() {
          factoryCallCount++
          const results: number[] = []
          let input: TerminatingReducerNext<number>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            results.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 42
        },
      })
      expect(factoryCallCount).toBe(0)

      expect(reducers[42].next(TERMINATING_REDUCER_COMPLETE).value).toBe(42)
      expect(factoryCallCount).toBe(1)
    })

    it('should work with symbol keys', () => {
      const sym = Symbol('test')
      let factoryCallCount = 0
      const reducers = createTerminatingReducers({
        *[sym]() {
          factoryCallCount++
          const results: symbol[] = []
          let input: TerminatingReducerNext<symbol>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            results.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return sym
        },
      })
      expect(factoryCallCount).toBe(0)

      expect(reducers[sym].next(TERMINATING_REDUCER_COMPLETE).value).toBe(sym)
      expect(factoryCallCount).toBe(1)
    })
  })

  describe('reducer lifecycle', () => {
    it('should handle FINISH token correctly', () => {
      const reducers = createTerminatingReducers({
        *test() {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'finished'
        },
      })
      const result = reducers.test.next(TERMINATING_REDUCER_COMPLETE)

      expect(result.done).toBe(true)
      expect(result.value).toBe('finished')
    })

    it('should handle CANCEL token correctly', () => {
      const reducers = createTerminatingReducers({
        *test() {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'not cancelled'
        },
      })
      const result = reducers.test.next(TERMINATING_REDUCER_CANCEL)

      expect(result.done).toBe(true)
      expect(result.value).toBe(undefined)
    })

    it('should handle promise return values', () => {
      const promise = Promise.resolve('async result')
      const reducers = createTerminatingReducers({
        *test() {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return promise
        },
      })
      const result = reducers.test.next(TERMINATING_REDUCER_COMPLETE)

      expect(result.done).toBe(true)
      expect(result.value).toBe(promise)
    })

    it('should propagate errors from generators', () => {
      const reducers = createTerminatingReducers({
        *test() {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          throw new Error('generator error')
        },
      })

      expect(() => {
        reducers.test.next(TERMINATING_REDUCER_COMPLETE)
      }).toThrow('generator error')
    })

    it('should handle user keys correctly', () => {
      const reducers = createTerminatingReducers({
        *test() {
          const inputs: Array<'customKey'> = []
          let input: TerminatingReducerNext<'customKey'>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return inputs.includes('customKey') ? 'custom key received' : 'something else'
        },
      })

      const result = reducers.test.next('customKey')
      expect(result.done).toBe(false)
      expect(reducers.test.next(TERMINATING_REDUCER_COMPLETE).value).toBe('custom key received')
    })
  })

  describe('enumeration behavior', () => {
    it('Object.keys should return all keys without triggering initialization', () => {
      let factoryCallCount = 0
      const reducers = createTerminatingReducers({
        *test1() {
          factoryCallCount++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'result1'
        },
        *test2() {
          factoryCallCount++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'result2'
        },
      })
      const keys = Object.keys(reducers)

      expect(keys).toEqual(['test1', 'test2'])
      expect(factoryCallCount).toBe(0)

      // Initialize one key
      expect(() => reducers.test1).to.not.throw()
      expect(factoryCallCount).toBe(1)

      // Keys should still return all keys
      const keysAfter = Object.keys(reducers)
      expect(keysAfter).toEqual(['test1', 'test2'])
      expect(factoryCallCount).toBe(1) // No additional calls
    })

    it('Object.values should trigger initialization of all string keys', () => {
      let factoryCallCount1 = 0
      let factoryCallCount2 = 0

      const reducers = createTerminatingReducers({
        *key1() {
          factoryCallCount1++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'value1'
        },
        *key2() {
          factoryCallCount2++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'value2'
        },
      })
      expect(factoryCallCount1).toBe(0)
      expect(factoryCallCount2).toBe(0)

      // Object.values will trigger initialization of all enumerable properties
      const values = Object.values(reducers)
      expect(values).toHaveLength(2)
      expect(factoryCallCount1).toBe(1)
      expect(factoryCallCount2).toBe(1)

      // Values should be the cached instances
      expect(values[0] === reducers.key1).toBe(true)
      expect(values[1] === reducers.key2).toBe(true)

      // Second call should not trigger additional initialization
      const values2 = Object.values(reducers)
      expect(factoryCallCount1).toBe(1) // Still 1
      expect(factoryCallCount2).toBe(1) // Still 1
      expect(values2[0] === values[0]).toBe(true) // Same instances
      expect(values2[1] === values[1]).toBe(true)
    })

    it('Object.entries should trigger initialization of all string keys', () => {
      let factoryCallCount1 = 0
      let factoryCallCount2 = 0

      const reducers = createTerminatingReducers({
        *key1() {
          factoryCallCount1++
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            // Just ignore inputs for this test
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'value1'
        },
        *key2() {
          factoryCallCount2++
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            // Just ignore inputs for this test
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'value2'
        },
      })
      expect(factoryCallCount1).toBe(0)
      expect(factoryCallCount2).toBe(0)

      // Object.entries will trigger initialization of all enumerable properties
      const entries = Object.entries(reducers)
      expect(entries).toHaveLength(2)
      expect(factoryCallCount1).toBe(1)
      expect(factoryCallCount2).toBe(1)

      // Entries should be key-value pairs with cached instances
      expect(entries[0][0]).toEqual('key1')
      expect(entries[0][1] === reducers.key1).toBe(true)
      expect(entries[1][0]).toEqual('key2')
      expect(entries[1][1] === reducers.key2).toBe(true)

      // Second call should not trigger additional initialization
      const entries2 = Object.entries(reducers)
      expect(factoryCallCount1).toBe(1) // Still 1
      expect(factoryCallCount2).toBe(1) // Still 1
      expect(entries2[0][1] === entries[0][1]).toBe(true) // Same instances
      expect(entries2[1][1] === entries[1][1]).toBe(true)
    })

    it('should handle symbol keys correctly but not enumerate them', () => {
      const sym = Symbol('test')
      let symbolCallCount = 0

      const reducers = createTerminatingReducers({
        *[sym]() {
          symbolCallCount++
          const inputs: symbol[] = []
          let input: TerminatingReducerNext<symbol>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return sym
        },
      })

      expect(Object.keys(reducers)).toEqual([])
      expect(symbolCallCount).toBe(0)

      // Symbol key should work via direct access
      expect(reducers[sym].next(TERMINATING_REDUCER_COMPLETE).value).toBe(sym)
      expect(symbolCallCount).toBe(1)

      // But still not enumerable
      expect(Object.keys(reducers)).toEqual([])
    })
  })

  describe('performance and edge cases', () => {
    it('should only initialize accessed keys', () => {
      let call1 = 0
      let call2 = 0
      let call3 = 0

      const reducers = createTerminatingReducers({
        *unused1() {
          call2++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'unused1'
        },
        *unused2() {
          call3++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'unused2'
        },
        *used() {
          call1++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'used'
        },
      })

      expect(reducers.used.next(TERMINATING_REDUCER_COMPLETE).value).toBe('used')
      expect(call1).toBe(1)
      expect(call2).toBe(0)
      expect(call3).toBe(0)
    })

    it('should preserve completed reducers in cache', () => {
      let factoryCallCount = 0
      const reducers = createTerminatingReducers({
        *test() {
          factoryCallCount++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'completed'
        },
      })
      const reducer = reducers.test

      // Complete the reducer
      const result = reducer.next(TERMINATING_REDUCER_COMPLETE)
      expect(result.value).toBe('completed')
      expect(result.done).toBe(true)
      expect(factoryCallCount).toBe(1)

      // Accessing again should return same completed instance
      const sameReducer = reducers.test
      expect(sameReducer === reducer).toBe(true)
      expect(factoryCallCount).toBe(1)
    })

    it('should work with empty factory map', () => {
      const reducers = createTerminatingReducers({})

      expect(Object.keys(reducers)).toEqual([])
      expect(Object.values(reducers)).toEqual([])
      expect(Object.entries(reducers)).toEqual([])
    })

    it('should handle mixed completion states', () => {
      const reducers = createTerminatingReducers({
        *cancelled() {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'not cancelled'
        },
        *finished() {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return inputs.length > 0 ? 'not finished' : 'finished'
        },
        *pending() {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          // First yield - for priming
          input = yield

          // Second yield - collect first input
          if (isTerminatingReducerNotTerminated(input)) {
            inputs.push(input)
            input = yield
          }

          // Continue with remaining inputs until termination
          while (isTerminatingReducerNotTerminated(input)) {
            inputs.push(input)
            input = yield
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'pending'
        },
      })

      expect(reducers.finished.next(TERMINATING_REDUCER_COMPLETE).value).toBe('finished')
      expect(reducers.cancelled.next(TERMINATING_REDUCER_CANCEL).value).toBe(undefined)

      const pending = reducers.pending
      expect(pending.next('step1').done).toBe(false)

      expect(reducers.pending === pending).toBe(true)
    })
  })
})
