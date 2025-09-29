/* eslint-disable typescript/no-empty-object-type */
import { remove } from 'coastal'

/**
 * Control token signaling a terminating reducer to complete and return its final value.
 */
export const TERMINATING_REDUCER_COMPLETE: unique symbol = Symbol.for(
  'cassiopeia/terminating-reducer/complete',
)
/**
 * Control token signaling a terminating reducer to cancel
 */
export const TERMINATING_REDUCER_CANCEL: unique symbol = Symbol.for(
  'cassiopeia/terminating-reducer/cancel',
)

/**
 * Type alias for the cancel control token symbol.
 */
export type TerminatingReducerCancel = typeof TERMINATING_REDUCER_CANCEL

/**
 * Type alias for the complete control token symbol.
 */
export type TerminatingReducerComplete = typeof TERMINATING_REDUCER_COMPLETE

/**
 * Union type representing all possible input values for a terminating reducer.
 */
export type TerminatingReducerNext<GeneratorNext = unknown> =
  | GeneratorNext
  | TerminatingReducerCancel
  | TerminatingReducerComplete

/**
 * Union type representing all possible return values for a terminating reducer.
 */
export type TerminatingReducerReturn<GeneratorReturn = unknown> = GeneratorReturn | undefined

/**
 * Generator type representing a synchronous terminating reducer.
 *
 * @typeParam GeneratorReturn - The type of value returned when the reducer completes normally
 * @typeParam GeneratorNext - The type of data values accepted as input during processing
 *
 * Terminating reducers are synchronous generators that implement a controlled processing
 * pattern where they yield nothing during execution, accept typed input through `.next()`
 * including control tokens, and return either a final computed value or `undefined` when
 * processing completes or is cancelled.
 */
export type TerminatingReducer<
  GeneratorReturn = unknown,
  GeneratorNext = unknown,
  T = undefined,
> = Generator<T, TerminatingReducerReturn<GeneratorReturn>, TerminatingReducerNext<GeneratorNext>>

/**
 * Input type for `createTerminatingReducers()` defining factory functions for each reducer key.
 *
 * @typeParam T - Object type where each property value extends `TerminatingReducer`
 *
 * Maps each property key to a factory function that returns a `TerminatingReducer` for that key.
 * Factory functions are invoked exactly once per property upon first access, after which
 * the getter is replaced with the static reducer instance for direct access.
 */
export type TerminatingReducerFactories<T extends object = {}> = {
  [K in keyof T]: () => T[K] extends TerminatingReducer ? T[K] : never
}

/**
 * Return type from `createTerminatingReducers()` with implicit caching through getter replacement.
 *
 * @typeParam T - Object type where each property value extends `TerminatingReducer`
 *
 * Properties provide lazy initialization with implicit caching behavior: first access triggers
 * factory invocation and getter replacement with the static value, eliminating subsequent
 * factory calls for the same property.
 */
export type TerminatingReducers<T extends object = {}> = {
  readonly [K in keyof T]: T[K] extends TerminatingReducer ? T[K] : never
}

/**
 * Creates terminating reducers with implicit caching through getter replacement.
 *
 * Sets up property getters for the specified keys that provide lazy initialization with
 * implicit caching behavior. Upon first access, each getter invokes the corresponding
 * factory function exactly once, eagerly primes the returned reducer instance, then
 * replaces itself with a static property containing the primed reducer. This eliminates
 * subsequent factory calls and getter overhead for the same property.
 *
 * @typeParam T - Object type where each property value extends `TerminatingReducer`
 * @param reducerFactories - Record mapping each key to a factory function that returns a terminating reducer
 * @param keys - Iterable of keys from the factories record to set up as lazy properties
 * @returns Object with specified keys providing lazy initialization and implicit caching
 *
 * Property enumeration behavior reflects the getter-to-value transformation:
 * - Initially all properties are non-enumerable getters, excluded from `Object.keys/values/entries`
 * - After first access, properties become enumerable static values included in enumeration
 * - `Object.keys()` reflects only currently enumerable (accessed) properties
 * - `Object.values()` and `Object.entries()` trigger initialization of accessed properties only
 */
export function createTerminatingReducers<T extends object>(
  reducerFactories: TerminatingReducerFactories<T>,
  keys: Iterable<keyof T>,
): TerminatingReducers<T> {
  // eslint-disable-next-line typescript/consistent-type-assertions
  const reducers = {} as TerminatingReducers<T>

  for (const key of keys) {
    Reflect.defineProperty(reducers, key, {
      configurable: true,
      enumerable: false,
      get() {
        const factory = reducerFactories[key]

        if (factory === undefined) {
          Reflect.deleteProperty(reducers, key)
          return
        }

        const value = factory()

        // Eager prime the reducer with no argument
        value.next()

        Reflect.defineProperty(reducers, key, {
          configurable: false,
          enumerable: true,
          value,
        })

        return value
      },
    })
  }

  return reducers
}

/**
 * Creates a revocable proxy that intercepts factory modifications with lifecycle callbacks.
 *
 * Wraps terminating reducer factories in a proxy that tracks property modifications,
 * maintains a synchronized array of reducer keys, and provides controlled disposal.
 * The proxy intercepts set and delete operations, calling corresponding lifecycle
 * callbacks and updating the key array. Disposal revokes the proxy, clears all
 * factory properties, and empties the key tracking array.
 *
 * @typeParam T - Object type where each property value extends `TerminatingReducer`
 * @typeParam U - Return type of the disposal callback
 * @param reducerFactories - Reducer factory functions to wrap with proxy behavior
 * @param options - Lifecycle callbacks and disposal handler
 * @returns Object containing the proxied factories, current keys array, and dispose method
 */
export function createTerminatingReducerFactoriesProxy<T extends object = {}, U = unknown>(
  reducerFactories: TerminatingReducerFactories<T>,
  options: {
    onDelete: (key: keyof T) => void
    onDispose: () => U
    onSet: (key: keyof T) => void
  },
): {
  dispose: () => U
  reducerFactories: TerminatingReducerFactories<T>
  reducerKeys: ReadonlyArray<keyof T>
} {
  const onSet = options?.onSet
  const onDelete = options?.onDelete
  const reducerKeys: Array<keyof T> = []

  const { proxy, revoke } = Proxy.revocable(reducerFactories, {
    set(target, key, value, receiver) {
      const success = Reflect.set(target, key, value, receiver)

      if (success) {
        if (!reducerKeys.includes(key as keyof T)) {
          reducerKeys.push(key as keyof T)
        }
        onSet?.(key as keyof T)
      }

      return success
    },

    deleteProperty(target, key) {
      const success = Reflect.deleteProperty(target, key)

      if (success) {
        remove(reducerKeys, (value) => value === key)
        onDelete?.(key as keyof T)
      }

      return success
    },
  })

  const dispose = () => {
    revoke()
    for (const key of reducerKeys) {
      Reflect.deleteProperty(reducerFactories, key)
    }
    reducerKeys.length = 0
    return options?.onDispose?.()
  }

  return { dispose, reducerFactories: proxy, reducerKeys }
}

/**
 * Type guard that filters out termination control tokens from reducer inputs.
 *
 * @typeParam U - The expected user data type (defaults to `unknown`)
 * @param value - Input value that could be user data or a control token
 * @returns `true` when the value is user data of type `U`, `false` for control tokens
 *
 * Checks whether a reducer input value is actual user data rather than a control
 * token. When this function returns `true`, TypeScript narrows the value type from
 * `TerminatingReducerNextInput<U>` to `U`, enabling type-safe processing of user data
 * while excluding `TERMINATING_REDUCER_CANCEL` and `TERMINATING_REDUCER_COMPLETE` tokens.
 */
export function isTerminatingReducerNotTerminated<U = unknown>(
  value: TerminatingReducerNext<U>,
): value is U {
  return value !== TERMINATING_REDUCER_CANCEL && value !== TERMINATING_REDUCER_COMPLETE
}

/**
 * Type guard that identifies termination control tokens in reducer inputs.
 *
 * @typeParam U - The expected user data type (defaults to `unknown`)
 * @param value - Input value that could be user data or a control token
 * @returns `true` when the value is a control token, `false` for user data
 *
 * Checks whether a reducer input value is a termination control token rather than
 * user data. When this function returns `true`, TypeScript narrows the value type from
 * `TerminatingReducerNext<U>` to `TerminatingReducerCancel | TerminatingReducerComplete`,
 * enabling type-safe handling of control tokens.
 */
export function isTerminatingReducerTerminated<U = unknown>(
  value: TerminatingReducerNext<U>,
): value is TerminatingReducerCancel | TerminatingReducerComplete {
  return value === TERMINATING_REDUCER_CANCEL || value === TERMINATING_REDUCER_COMPLETE
}
