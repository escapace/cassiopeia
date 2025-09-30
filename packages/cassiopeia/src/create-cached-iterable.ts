/* eslint-disable typescript/no-explicit-any */

import { CASSIOPEIA_CANCEL } from './constants'
import type { CassiopeiaCancel } from './types'

/**
 * Type guard that filters out CASSIOPEIA_CANCEL token from iterable inputs.
 *
 * @typeParam U - The expected user data type
 * @param value - Input value that could be user data or a cancel token
 * @returns `true` when the value is user data, `false` for cancel token
 *
 * Checks whether an iterable input value is actual user data rather than a
 * cancellation token. When this function returns `true`, TypeScript narrows the
 * value type from `CassiopeiaCancel | U` to `U`, enabling type-safe processing
 * of user data while excluding the `CASSIOPEIA_CANCEL` token.
 */
export function isIterableActive<U = unknown>(value: CassiopeiaCancel | U): value is U {
  return value !== CASSIOPEIA_CANCEL
}

/**
 * Type guard that identifies CASSIOPEIA_CANCEL token in iterable inputs.
 *
 * @typeParam U - The expected user data type
 * @param value - Input value that could be user data or a cancel token
 * @returns `true` when the value is a cancel token, `false` for user data
 *
 * Checks whether an iterable input value is a cancellation token rather than
 * user data. When this function returns `true`, TypeScript narrows the value
 * type from `CassiopeiaCancel | U` to `CassiopeiaCancel`, enabling type-safe
 * handling of cancellation tokens.
 */
export function isIterableTerminated<U = unknown>(
  value: CassiopeiaCancel | U,
): value is CassiopeiaCancel {
  return value === CASSIOPEIA_CANCEL
}

/**
 * State enumeration representing the lifecycle of the cached iterable's source.
 */
enum SourceState {
  ACTIVE = 1,
  CANCELLED = 3,
  EXHAUSTED = 2,
  IDLE = 0,
}

/**
 * Cached iterable with shared caching and external cancellation control.
 *
 * @typeParam T - The type of values yielded by the iterable
 * @typeParam TReturn - The type of the return value from the source iterator
 *
 * Combines the standard `Iterable` interface with external cancellation capabilities.
 * Extends `Iterable<T, TReturn | undefined, TerminatingReducerCancel | undefined>` to provide
 * iterator-based value consumption while adding a direct cancellation method that operates
 * independently of any active iterator instances.
 *
 * @remarks
 * **Iterator Behavior:**
 * - Implements standard iterator protocol with `Symbol.iterator` method
 * - Return type is `TReturn | undefined` since cancellation can prevent source completion
 * - Accepts `TerminatingReducerCancel | undefined` as input to iterator `next()` calls
 *
 * **Shared Caching:**
 * - Multiple iterators created from the same cached iterable share a common value cache
 * - Values are cached incrementally as consumed from the source
 * - Cache persists across iterator instances and survives iterator completion
 *
 * **External Cancellation:**
 * - Provides direct cancellation control without requiring an active iterator
 * - Cancellation clears current source iterator; new iterators created after cancellation return done immediately
 * - Already-cached values remain accessible through existing iterators until they complete
 */
export interface CachedIterable<T, TReturn = unknown>
  extends Iterable<T, TReturn | undefined, CassiopeiaCancel | undefined> {
  /**
   * Cancels the cached iterable and terminates any ongoing source iteration.
   *
   * Provides external cancellation control without requiring an active iterator instance.
   * Forwards `CASSIOPEIA_CANCEL` to the source iterator following the same
   * contract as iterator-based cancellation through `next(CASSIOPEIA_CANCEL)`.
   *
   * @remarks
   * **Cancellation Effects:**
   * - Sends `CASSIOPEIA_CANCEL` to the current source before clearing it
   * - Clears the current source iterator, forcing active iterators to complete gracefully immediately
   * - New iterators created after cancellation immediately return done without extending cache or creating sources
   *
   * **Idempotent Operation:**
   * - Safe to call multiple times without side effects
   * - Subsequent calls have no effect if no active source iterator exists
   * - No error is thrown for redundant cancellation attempts
   *
   * **Source Iterator Contract:**
   * - Source iterator must handle `CASSIOPEIA_CANCEL` and return immediately
   * - Source iterator must not perform additional work after receiving the cancel token
   * - Source iterator must not yield additional values after cancellation
   * - Contract violation may result in unpredictable cache states
   */
  [CASSIOPEIA_CANCEL]: () => void
  // cancelled: boolean
}

/**
 * Creates a cached iterable that wraps a factory-produced iterable with lazy evaluation and shared caching.
 *
 * Values are cached as they are consumed from the source iterator, enabling multiple iterators
 * to share the same underlying data without redundant factory calls or source re-evaluation.
 * Each iterator follows a two-phase approach: first consuming cached values, then extending
 * the cache by consuming from the source if the cache requires extension.
 *
 * @typeParam T - The type of values yielded by the iterable
 * @typeParam TReturn - The type of the return value from the source iterator
 *
 * @param factory - Function that creates the source iterable. Called exactly once when the first
 *                  cache extension is needed. Must return an iterable that accepts
 *                  `TerminatingReducerCancel | undefined` as input.
 *
 * @returns A {@link CachedIterable} that yields the same values as the source but with caching behavior.
 *          Return value is `TReturn | undefined` since cancellation can prevent source completion.
 *
 * @remarks
 * **Iterator Behavior:**
 * - Iterators first yield cached values in order
 * - Multiple iterators cooperatively extend the shared cache as needed
 * - Any iterator can extend the cache when requiring values beyond the current cached set
 * - Iterators that have used a cleared source complete gracefully immediately
 *
 * **Caching Behavior:**
 * - Values are cached incrementally as consumed from the source
 * - Multiple iterators share the same cache and cooperatively extend it
 * - Cache preserves values consumed before errors or cancellation
 *
 * **Lazy Evaluation:**
 * - Factory is not called until an iterator needs to extend the cache
 * - Source iterator creation is deferred until the first cache extension is required
 *
 * **Cancellation Support:**
 * The returned cached iterable supports two cancellation approaches:
 *
 * 1. **Iterator-based cancellation:** Pass `CASSIOPEIA_CANCEL` to any iterator's `next()` method
 * 2. **Method-based cancellation:** Call the `CASSIOPEIA_CANCEL` method directly on the cached iterable
 *
 * Both approaches have the same immediate effects:
 * - `CASSIOPEIA_CANCEL` is forwarded to the current source iterator
 * - Current source iterator is cleared, allowing active iterators to complete gracefully
 * - New iterators created after cancellation immediately return done without creating sources
 *
 * **Source Iterable Contract:**
 * - Source iterables must check for `CASSIOPEIA_CANCEL` and return immediately
 * - Source iterables must not perform additional work after receiving the cancel token
 * - Source iterables must not yield additional values after cancellation
 * - Iterables that violate this contract may result in unpredictable cache states
 */
export function createCachedIterable<T, TReturn = any>(
  factory: () => Iterable<T, TReturn, CassiopeiaCancel | undefined>,
): CachedIterable<T, TReturn> {
  const cache: T[] = []
  let sourceState = SourceState.IDLE
  let sourceIterator: Iterator<T, TReturn | undefined, CassiopeiaCancel | undefined> | undefined

  // TODO: optimize
  const cancel = () => {
    if (sourceState === SourceState.ACTIVE) {
      sourceIterator!.next(CASSIOPEIA_CANCEL)
      sourceState = SourceState.CANCELLED
      sourceIterator = undefined
    }

    if (sourceState === SourceState.EXHAUSTED || sourceState === SourceState.IDLE) {
      sourceState = SourceState.CANCELLED
    }
  }

  function* createGenerator(): Generator<T, TReturn | undefined, CassiopeiaCancel | undefined> {
    let index = 0

    if ((yield undefined as T) === CASSIOPEIA_CANCEL) {
      cancel()
      return
    }

    // Create source if needed
    if (sourceState === SourceState.IDLE) {
      sourceState = SourceState.ACTIVE
      // Iterator has never used source, create it now
      sourceIterator = factory()[Symbol.iterator]()
    }

    // If method cancellation occurred for this specific iterator, complete
    while (sourceState !== SourceState.CANCELLED) {
      // If we have a cached value, yield it
      if (index < cache.length) {
        const next = yield cache[index]
        index += 1

        if (next === CASSIOPEIA_CANCEL) {
          cancel()
          return
        }

        continue
      }

      // We need to extend the cache, but can't if source is exhausted
      if (sourceState === SourceState.EXHAUSTED) {
        return
      }

      const step = sourceIterator!.next()

      if (step.done === true) {
        sourceState = SourceState.EXHAUSTED
        sourceIterator = undefined
        return step.value as TReturn
      } else {
        cache.push(step.value)
      }
    }

    return
  }

  return {
    // get cancelled() {
    //   return sourceState === SourceState.CANCELLED
    // },
    [CASSIOPEIA_CANCEL]() {
      cancel()
    },
    [Symbol.iterator](): Iterator<T, TReturn | undefined, CassiopeiaCancel | undefined> {
      const generator = createGenerator()
      generator.next()

      return generator
    },
  }
}
