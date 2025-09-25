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

export const TERMINATING_REDUCER_FACTORIES: unique symbol = Symbol.for(
  'cassiopeia/terminating-reducer/factories',
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
 * pattern where they yield nothing during execution, accept typed input through `.next()`,
 * and return either a final computed value or `TerminatingReducerCancel` when cancelled.
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
 * Factory functions are called exactly once per key upon first access to the corresponding
 * property getter in the returned `TerminatingReducersMap`.
 */
export type TerminatingReducerFactories<T extends object = {}> = {
  [K in keyof T]: () => T[K] extends TerminatingReducer ? T[K] : never
}

/**
 * Return type from `createTerminatingReducers()` providing lazy, cached access to reducer instances.
 *
 * @typeParam T - Object type where each property value extends `TerminatingReducer`
 *
 * An intersection type that combines property getters for each reducer key with an update method
 * for cache management. Each property getter implements lazy initialization with eager priming
 * and caching semantics.
 */
export type TerminatingReducers<T extends object = {}> = {
  readonly [TERMINATING_REDUCER_FACTORIES]: TerminatingReducerFactories<T>
} & Omit<
  {
    readonly [K in keyof T]: T[K] extends TerminatingReducer ? T[K] : never
  },
  typeof TERMINATING_REDUCER_FACTORIES
>
/**
 * Creates a terminating reducers with lazy, cached property getters.
 *
 * Transforms factory functions into a map object where each property provides lazy access
 * to cached terminating reducer instances. Property getters create instances only on first
 * access, with exactly-once factory invocation and eager priming for immediate readiness.
 * The returned object includes symbol-keyed methods for cache management and factory access.
 *
 * @typeParam T - Object type where each property value extends `TerminatingReducer`
 * @param factories - Record mapping each key to a factory function that returns a terminating reducer
 * @returns Object with lazy property getters for reducer instances and cache management methods
 *
 * Property enumeration behavior on the returned map follows standard JavaScript conventions:
 * - String and number keys are enumerable and appear in `Object.keys/values/entries`
 * - Symbol keys are non-enumerable and excluded from standard enumeration methods
 * - `Object.keys()` returns all keys without triggering initialization
 * - `Object.values()` and `Object.entries()` trigger initialization of all enumerable properties
 */
export function createTerminatingReducers<T extends object>(
  factories?: TerminatingReducerFactories<T>,
): TerminatingReducers<T> {
  const reducerFactories = (factories ?? {}) as TerminatingReducerFactories<T>
  const cache = new Map<keyof T, TerminatingReducer>()
  // eslint-disable-next-line typescript/consistent-type-assertions
  const reducers = {} as TerminatingReducers<T>

  // Helper function to define a property with the correct enumerable setting
  const definePropertyGetter = (key: keyof T) => {
    Object.defineProperty(reducers, key, {
      configurable: true,
      enumerable: typeof key !== 'symbol',
      get() {
        if (cache.has(key)) {
          return cache.get(key)
        }

        const factory = reducerFactories[key]

        if (factory === undefined) {
          return
        }

        const reducer = factory()

        // Eager prime the reducer with no argument
        reducer.next()

        cache.set(key, reducer)

        return reducer
      },
    })
  }

  for (const key of [
    ...(Object.keys(reducerFactories) as Array<keyof T>),
    ...(Object.getOwnPropertySymbols(reducerFactories) as Array<keyof T>),
  ]) {
    definePropertyGetter(key)
  }

  for (const [key, value] of [[TERMINATING_REDUCER_FACTORIES, reducerFactories]] as const) {
    Object.defineProperty(reducers, key, {
      configurable: true,
      enumerable: false,
      value,
      writable: false,
    })
  }

  return reducers
}

/**
 * Creates a shallow clone of a terminating reducers with independent state.
 *
 * @typeParam T - Object type where each property value extends `TerminatingReducer`
 * @param reducers - The terminating reducers to clone
 * @returns New terminating reducers with fresh cache and independent state
 */
export function cloneTerminatingReducers<T extends object = {}>(
  reducers: TerminatingReducers<T>,
): TerminatingReducers<T> {
  const reducerFactories = reducers[TERMINATING_REDUCER_FACTORIES]
  return createTerminatingReducers({ ...reducerFactories })
}

/**
 * Creates a revocable proxy that intercepts factory modifications with lifecycle callbacks.
 *
 * @typeParam T - Object type where each property value extends `TerminatingReducer`
 * @param reducers - Terminating reducers object
 * @param options - Optional configuration object
 * @returns Object containing dispose method, properties tracking array, and the revocable proxy
 */
export function createTerminatingReducerFactoriesProxy<T extends object = {}>(
  reducers: TerminatingReducers<T>,
  options?: {
    onDelete?: (key: keyof T) => void
    onDispose?: () => void
    onSet?: (key: keyof T) => void
  },
): {
  dispose: () => void
  reducerFactories: TerminatingReducerFactories<T>
  reducerKeys: ReadonlyArray<keyof T>
} {
  const onSet = options?.onSet
  const onDelete = options?.onDelete
  const reducerKeys: Array<keyof T> = []
  const reducerFactoriesTarget = reducers[TERMINATING_REDUCER_FACTORIES]

  const { proxy: reducerFactories, revoke } = Proxy.revocable(reducerFactoriesTarget, {
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
      Reflect.deleteProperty(reducerFactoriesTarget, key)
    }
    reducerKeys.length = 0
    options?.onDispose?.()
  }

  return { dispose, reducerFactories, reducerKeys }
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
export function isTerminatingReducerTerminated<U = unknown>(
  value: TerminatingReducerNext<U>,
): value is U {
  return value === TERMINATING_REDUCER_CANCEL || value === TERMINATING_REDUCER_COMPLETE
}
