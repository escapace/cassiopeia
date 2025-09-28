import { interpret } from '@escapace/fsm'
import { remove } from 'coastal'
import { CASSIOPEIA_CONTEXT, CASSIOPEIA_PLUGIN, CASSIOPEIA_STATE } from './constants'
import { stateMachine } from './state-machine'
import {
  createTerminatingReducerFactoriesProxy,
  createTerminatingReducers,
  TERMINATING_REDUCER_CANCEL,
} from './create-terminating-reducers'
import {
  CassiopeiaStateMachineAction,
  CassiopeiaStateMachineActionUpdateType,
  CassiopeiaStateMachineState,
  type Cassiopeia,
  type CassiopeiaGenerator,
  type CassiopeiaPlugin,
  type CassiopeiaPluginContext,
  type CassiopeiaReducer,
  type CassiopeiaReducerUpdate,
  type CassiopeiaStateMachineActionUpdateOptions,
  type CassiopeiaSubscription,
} from './types'
import { createScheduler } from './create-scheduler'

// TODO: updateSync is a bad name
// TODO: keys can be a set?
// TODO: promise returning reducers?

export function createCassiopeia(): Cassiopeia {
  const subscriptions: CassiopeiaSubscription[] = []
  const plugins = new Map<CassiopeiaPlugin, CassiopeiaPluginContext>()
  const machine = interpret(stateMachine)
  const { context } = machine
  const reducers = createTerminatingReducers<Record<string, CassiopeiaReducer>>()
  context.reducers = reducers
  const updateCallbacks: Array<() => void> = []

  let reduceQueued = false

  const unsubscribe = machine.subscribe((state) => {
    if (state.action.type === CassiopeiaStateMachineAction.Update) {
      if (!reduceQueued) {
        if (state.action.payload.updateIsAsync) {
          reduceQueued = true
          context.defer(() => {
            reduceQueued = false
            machine.do(CassiopeiaStateMachineAction.Reduce)
          })
        } else {
          machine.do(CassiopeiaStateMachineAction.Reduce)
        }
      }
    } else if (
      state.action.source === CassiopeiaStateMachineState.PreFlight &&
      state.action.type === CassiopeiaStateMachineAction.Reduce &&
      state.state === CassiopeiaStateMachineState.InFlight
    ) {
      if (__PLATFORM__ === 'node') {
        machine.do(CassiopeiaStateMachineAction.Done)
      } else {
        const value = createScheduler(context)

        if (value instanceof Promise) {
          void Promise.resolve(value).then((value) => {
            if (value !== undefined) {
              for (const subscription of subscriptions) {
                subscription(value)
              }

              machine.do(CassiopeiaStateMachineAction.Done)
            }
          })
        } else if (value !== undefined) {
          for (const subscription of subscriptions) {
            subscription(value)
          }

          machine.do(CassiopeiaStateMachineAction.Done)
        }
      }
    } else if (
      state.action.source === CassiopeiaStateMachineState.InFlight &&
      state.action.type === CassiopeiaStateMachineAction.Done &&
      state.state === CassiopeiaStateMachineState.Idle
    ) {
      for (const resolve of updateCallbacks) {
        resolve()
      }
      updateCallbacks.length = 0
    }
  })

  const updateOptions: CassiopeiaStateMachineActionUpdateOptions =
    {} as unknown as CassiopeiaStateMachineActionUpdateOptions

  const machineActionUpdate = async (
    updateType: CassiopeiaStateMachineActionUpdateType,
    updateIsAsync: boolean,
    updateGenerator?: () => CassiopeiaGenerator,
    updateReducerKeys?: readonly string[],
  ): Promise<void> =>
    await new Promise<void>((resolve) => {
      updateCallbacks.push(resolve)

      updateOptions.updateType = updateType
      updateOptions.updateGenerator = updateGenerator
      updateOptions.updateIsAsync = updateIsAsync
      updateOptions.updateReducerKeys = updateReducerKeys

      machine.do(CassiopeiaStateMachineAction.Update, updateOptions)
    })

  const dispose = () => {
    unsubscribe()
    subscriptions.length = 0

    for (const metadata of plugins.values()) {
      void metadata.dispose()
    }
    plugins.clear()

    for (const resolve of updateCallbacks) {
      resolve()
    }
    updateCallbacks.length = 0

    context.generator?.[TERMINATING_REDUCER_CANCEL]()
    context.orchestrator?.next(TERMINATING_REDUCER_CANCEL)
    context.orchestrator = undefined
    context.reducers = createTerminatingReducers<Record<string, CassiopeiaReducer>>()
    context.updateIsAsync = true
    context.updateType = CassiopeiaStateMachineActionUpdateType.None
    context.updateGenerator = undefined
    context.generator = undefined
    if (context.updateReducerKeys !== undefined) {
      context.updateReducerKeys.length = 0
    }
  }

  const cassiopeia: Cassiopeia = {
    [CASSIOPEIA_CONTEXT]: context,
    get [CASSIOPEIA_STATE]() {
      return machine.state
    },
    dispose,
    subscribe: (subscription) => {
      if (!subscriptions.includes(subscription)) {
        subscriptions.push(subscription)
      }

      return () => {
        remove(subscriptions, (value) => value === subscription)
      }
    },
    update: async (updateGenerator) =>
      await machineActionUpdate(
        CassiopeiaStateMachineActionUpdateType.Generator,
        true,
        updateGenerator,
      ),
    updateSync: async (updateGenerator) =>
      await machineActionUpdate(
        CassiopeiaStateMachineActionUpdateType.Generator,
        false,
        updateGenerator,
      ),
    use: (...values) => {
      for (const plugin of values) {
        const install = plugin[CASSIOPEIA_PLUGIN]

        if (!plugins.has(plugin)) {
          const update: CassiopeiaReducerUpdate = async (keys) =>
            await machineActionUpdate(
              CassiopeiaStateMachineActionUpdateType.Reducer,
              true,
              undefined,
              keys ?? reducerKeys,
            )

          const updateSync: CassiopeiaReducerUpdate = async (keys) =>
            await machineActionUpdate(
              CassiopeiaStateMachineActionUpdateType.Reducer,
              false,
              undefined,
              keys ?? reducerKeys,
            )

          const context: CassiopeiaPluginContext = {
            update,
            updateSync,
            ...createTerminatingReducerFactoriesProxy(reducers, {
              onDelete: () => void update(),
              onDispose: () => {
                plugins.delete(plugin)
                // reducerKeys are already cleared by dispose()
                return update()
              },
              onSet: () => void update(),
            }),
          }
          const { reducerKeys } = context

          plugins.set(plugin, context)
          install(context)
        }
      }

      return cassiopeia
    },
  }

  return cassiopeia
}
