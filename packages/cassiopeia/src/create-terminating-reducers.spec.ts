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
      const factories = {
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
      }
      const reducers = createTerminatingReducers(factories, ['test'])

      expect(factoryCallCount).toBe(0)

      const reducer1 = reducers.test
      expect(factoryCallCount).toBe(1)

      const reducer2 = reducers.test
      expect(factoryCallCount).toBe(1)
      expect(reducer1 === reducer2).toBe(true)
    })

    it('should eager-prime reducers on first access', () => {
      const primeSteps: string[] = []
      const factories = {
        *test(): TerminatingReducer<string, string> {
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
      }
      const reducers = createTerminatingReducers(factories, ['test'])
      expect(primeSteps).toEqual([])

      const reducer = reducers.test
      expect(primeSteps).toEqual(['started'])

      const result = reducer.next(TERMINATING_REDUCER_COMPLETE)
      expect(result.value).toBe('result')
      expect(primeSteps).toEqual(['started', 'after-prime'])
    })

    it('should work with string keys', () => {
      let factoryCallCount = 0
      const factories = {
        *stringKey(): TerminatingReducer<string, string> {
          factoryCallCount++
          const results: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            results.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'string result'
        },
      }
      const reducers = createTerminatingReducers(factories, ['stringKey'])
      expect(factoryCallCount).toBe(0)

      expect(reducers.stringKey.next(TERMINATING_REDUCER_COMPLETE).value).toBe('string result')
      expect(factoryCallCount).toBe(1)
    })

    it('should work with number keys', () => {
      let factoryCallCount = 0
      const factories = {
        *42(): TerminatingReducer<number, number> {
          factoryCallCount++
          const results: number[] = []
          let input: TerminatingReducerNext<number>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            results.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 42
        },
      }
      const reducers = createTerminatingReducers(factories, ['42'])
      expect(factoryCallCount).toBe(0)

      expect(reducers[42].next(TERMINATING_REDUCER_COMPLETE).value).toBe(42)
      expect(factoryCallCount).toBe(1)
    })
  })

  describe('reducer lifecycle', () => {
    it('should handle FINISH token correctly', () => {
      const factories = {
        *test(): TerminatingReducer<string, string> {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'finished'
        },
      }
      const reducers = createTerminatingReducers(factories, ['test'])
      const result = reducers.test.next(TERMINATING_REDUCER_COMPLETE)

      expect(result.done).toBe(true)
      expect(result.value).toBe('finished')
    })

    it('should handle CANCEL token correctly', () => {
      const factories = {
        *test(): TerminatingReducer<string, string> {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'not cancelled'
        },
      }
      const reducers = createTerminatingReducers(factories, ['test'])
      const result = reducers.test.next(TERMINATING_REDUCER_CANCEL)

      expect(result.done).toBe(true)
      expect(result.value).toBe(undefined)
    })

    it('should handle promise return values', () => {
      const promise = Promise.resolve('async result')
      const factories = {
        *test(): TerminatingReducer<Promise<string>, string> {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return promise
        },
      }
      const reducers = createTerminatingReducers(factories, ['test'])
      const result = reducers.test.next(TERMINATING_REDUCER_COMPLETE)

      expect(result.done).toBe(true)
      expect(result.value).toBe(promise)
    })

    it('should propagate errors from generators', () => {
      const factories = {
        *test(): TerminatingReducer<string, string> {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          throw new Error('generator error')
        },
      }
      const reducers = createTerminatingReducers(factories, ['test'])

      expect(() => {
        reducers.test.next(TERMINATING_REDUCER_COMPLETE)
      }).toThrow('generator error')
    })

    it('should handle user keys correctly', () => {
      const factories = {
        *test(): TerminatingReducer<string, 'customKey'> {
          const inputs: Array<'customKey'> = []
          let input: TerminatingReducerNext<'customKey'>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return inputs.includes('customKey') ? 'custom key received' : 'something else'
        },
      }
      const reducers = createTerminatingReducers(factories, ['test'])

      const result = reducers.test.next('customKey')
      expect(result.done).toBe(false)
      expect(reducers.test.next(TERMINATING_REDUCER_COMPLETE).value).toBe('custom key received')
    })
  })

  describe('enumeration behavior', () => {
    it('Object.keys should return only enumerable (accessed) keys without triggering initialization', () => {
      let factoryCallCount = 0
      const factories = {
        *test1(): TerminatingReducer<string, string> {
          factoryCallCount++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'result1'
        },
        *test2(): TerminatingReducer<string, string> {
          factoryCallCount++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'result2'
        },
      }
      const reducers = createTerminatingReducers(factories, ['test1', 'test2'])

      // Initially no enumerable keys (properties are non-enumerable getters)
      const keys = Object.keys(reducers)
      expect(keys).toEqual([])
      expect(factoryCallCount).toBe(0)

      // Initialize one key - this makes it enumerable
      expect(() => reducers.test1).to.not.throw()
      expect(factoryCallCount).toBe(1)

      // Keys should now return the accessed key
      const keysAfter = Object.keys(reducers)
      expect(keysAfter).toEqual(['test1'])
      expect(factoryCallCount).toBe(1) // No additional calls
    })

    it('Object.values should only include already accessed properties', () => {
      let factoryCallCount1 = 0
      let factoryCallCount2 = 0

      const factories = {
        *key1(): TerminatingReducer<string, string> {
          factoryCallCount1++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'value1'
        },
        *key2(): TerminatingReducer<string, string> {
          factoryCallCount2++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'value2'
        },
      }
      const reducers = createTerminatingReducers(factories, ['key1', 'key2'])
      expect(factoryCallCount1).toBe(0)
      expect(factoryCallCount2).toBe(0)

      // Object.values should initially be empty (no enumerable properties)
      const initialValues = Object.values(reducers)
      expect(initialValues).toHaveLength(0)
      expect(factoryCallCount1).toBe(0)
      expect(factoryCallCount2).toBe(0)

      // Access one property to make it enumerable
      const key1Reducer = reducers.key1
      expect(factoryCallCount1).toBe(1)
      expect(factoryCallCount2).toBe(0)

      // Object.values should now include the accessed property
      const valuesAfterAccess = Object.values(reducers)
      expect(valuesAfterAccess).toHaveLength(1)
      expect(valuesAfterAccess[0] === key1Reducer).toBe(true)
      expect(factoryCallCount1).toBe(1) // Still 1
      expect(factoryCallCount2).toBe(0) // Still 0
    })

    it('Object.entries should only include already accessed properties', () => {
      let factoryCallCount1 = 0
      let factoryCallCount2 = 0

      const factories = {
        *key1(): TerminatingReducer<string, string> {
          factoryCallCount1++
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            // Just ignore inputs for this test
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'value1'
        },
        *key2(): TerminatingReducer<string, string> {
          factoryCallCount2++
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            // Just ignore inputs for this test
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'value2'
        },
      }
      const reducers = createTerminatingReducers(factories, ['key1', 'key2'])
      expect(factoryCallCount1).toBe(0)
      expect(factoryCallCount2).toBe(0)

      // Object.entries should initially be empty (no enumerable properties)
      const initialEntries = Object.entries(reducers)
      expect(initialEntries).toHaveLength(0)
      expect(factoryCallCount1).toBe(0)
      expect(factoryCallCount2).toBe(0)

      // Access both properties to make them enumerable
      const key1Reducer = reducers.key1
      const key2Reducer = reducers.key2
      expect(factoryCallCount1).toBe(1)
      expect(factoryCallCount2).toBe(1)

      // Object.entries should now include both accessed properties
      const entriesAfterAccess = Object.entries(reducers)
      expect(entriesAfterAccess).toHaveLength(2)
      expect(entriesAfterAccess[0][0]).toEqual('key1')
      expect(entriesAfterAccess[0][1] === key1Reducer).toBe(true)
      expect(entriesAfterAccess[1][0]).toEqual('key2')
      expect(entriesAfterAccess[1][1] === key2Reducer).toBe(true)
      expect(factoryCallCount1).toBe(1) // Still 1
      expect(factoryCallCount2).toBe(1) // Still 1
    })
  })

  describe('performance and edge cases', () => {
    it('should only initialize accessed keys', () => {
      let call1 = 0
      let call2 = 0
      let call3 = 0

      const factories = {
        *unused1(): TerminatingReducer<string, string> {
          call2++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'unused1'
        },
        *unused2(): TerminatingReducer<string, string> {
          call3++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'unused2'
        },
        *used(): TerminatingReducer<string, string> {
          call1++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'used'
        },
      }
      const reducers = createTerminatingReducers(factories, ['used'])

      expect(reducers.used.next(TERMINATING_REDUCER_COMPLETE).value).toBe('used')
      expect(call1).toBe(1)
      expect(call2).toBe(0)
      expect(call3).toBe(0)
    })

    it('should preserve completed reducers in cache', () => {
      let factoryCallCount = 0
      const factories = {
        *test(): TerminatingReducer<string, string> {
          factoryCallCount++
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'completed'
        },
      }
      const reducers = createTerminatingReducers(factories, ['test'])
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
      const reducers = createTerminatingReducers({}, [])

      expect(Object.keys(reducers)).toEqual([])
      expect(Object.values(reducers)).toEqual([])
      expect(Object.entries(reducers)).toEqual([])
    })

    it('should delete property and return undefined when factory is undefined', () => {
      const factories = {
        *existingFactory(): TerminatingReducer<string, string> {
          let input: TerminatingReducerNext<string>
          while (isTerminatingReducerNotTerminated((input = yield))) {
            // ignore inputs
          }
          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'exists'
        },
      }
      const reducers = createTerminatingReducers(factories, [
        'existingFactory',
        'missingFactory',
      ] as unknown as Array<keyof typeof factories>)

      // Verify the missing factory key exists initially as a property descriptor
      expect(Object.getOwnPropertyDescriptor(reducers, 'missingFactory')).toBeDefined()

      // Access the missing factory - should delete property and return undefined
      // @ts-expect-error wrong key
      expect(reducers.missingFactory).toBeUndefined()

      // Verify the property has been deleted
      expect(Object.getOwnPropertyDescriptor(reducers, 'missingFactory')).toBeUndefined()
      expect('missingFactory' in reducers).toBe(false)

      // Verify existing factory still works normally
      expect(reducers.existingFactory.next(TERMINATING_REDUCER_COMPLETE).value).toBe('exists')
    })

    it('should handle mixed completion states', () => {
      const factories = {
        *cancelled(): TerminatingReducer<string, string> {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return 'not cancelled'
        },
        *finished(): TerminatingReducer<string, string> {
          const inputs: string[] = []
          let input: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((input = yield))) {
            inputs.push(input)
          }

          if (input === TERMINATING_REDUCER_CANCEL) return undefined
          return inputs.length > 0 ? 'not finished' : 'finished'
        },
        *pending(): TerminatingReducer<string, string> {
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
      }
      const reducers = createTerminatingReducers(factories, ['cancelled', 'finished', 'pending'])

      expect(reducers.finished.next(TERMINATING_REDUCER_COMPLETE).value).toBe('finished')
      expect(reducers.cancelled.next(TERMINATING_REDUCER_CANCEL).value).toBe(undefined)

      const pending = reducers.pending
      expect(pending.next('step1').done).toBe(false)

      expect(reducers.pending === pending).toBe(true)
    })
  })
})
