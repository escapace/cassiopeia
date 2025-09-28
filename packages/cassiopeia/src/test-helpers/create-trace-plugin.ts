import {
  CASSIOPEIA_PLUGIN,
  isTerminatingReducerNotTerminated,
  TERMINATING_REDUCER_CANCEL,
  type CassiopeiaPlugin,
  type CassiopeiaPluginContext,
  type CassiopeiaReducer,
  type TerminatingReducerNext,
} from '../index'

interface TracePluginState {
  receivedMarkers: string[]
  wasCancelled: boolean
  wasCompleted: boolean
}

export function createTracePlugin(key: string, shouldAbort?: (value: string) => boolean) {
  const history: TracePluginState[] = []

  let context: CassiopeiaPluginContext | undefined

  const plugin: CassiopeiaPlugin = {
    [CASSIOPEIA_PLUGIN]: (context_) => {
      context = context_

      context.reducerFactories[key] = () => {
        const state: TracePluginState = {
          receivedMarkers: [],
          wasCancelled: false,
          wasCompleted: false,
        }

        history.push(state)

        // eslint-disable-next-line stylistic/wrap-iife
        return (function* createTraceReducer(): CassiopeiaReducer {
          const markers: string[] = []
          let localIndex = 0

          let token: TerminatingReducerNext<string>

          while (isTerminatingReducerNotTerminated((token = yield))) {
            // The token already includes the full ---key-suffix format
            state.receivedMarkers.push(token)
            markers.push(token.replace(`---${key}-`, ''))

            if (shouldAbort?.(token) === true) {
              break
            }
          }

          if (token === TERMINATING_REDUCER_CANCEL) {
            state.wasCancelled = true
            return undefined
          }

          state.wasCompleted = true

          if (markers.length === 0) {
            return undefined
          }

          return {
            content: `:root { ${markers.map((marker) => `---${key}-${marker}: ${++localIndex};`).join(' ')} }`,
          }
        })()
      }
    },
  }

  return {
    dispose: async () => {
      await context?.dispose?.()
    },
    history,
    plugin,
    get state() {
      return history.at(-1)
    },
    triggerDelete: () => {
      if (context !== undefined) {
        Reflect.deleteProperty(context.reducerFactories, key)
      }
    },
    triggerSet: () => {
      if (context !== undefined) {
        const value = context.reducerFactories[key]
        context.reducerFactories[key] = value
      }
    },
    update: async (keys?: string[]) => {
      await context?.update?.(keys)
    },
    updateSync: async (keys?: string[]) => {
      await context?.updateSync?.(keys)
    },
  }
}
