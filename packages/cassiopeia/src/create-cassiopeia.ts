import { interpret } from '@escapace/fsm'
import { remove } from 'coastal'
import { CASSIOPEIA_CONTEXT, CASSIOPEIA_PLUGIN, CASSIOPEIA_STATE } from './constants'
import { createScheduler } from './create-scheduler'
import {
  createTerminatingReducerFactoriesProxy,
  createTerminatingReducers,
  TERMINATING_REDUCER_CANCEL,
} from './create-terminating-reducers'
import { stateMachine } from './state-machine'
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
  type CassiopeiaReducerUpdateSync,
  type CassiopeiaStateMachineActionUpdateOptions,
  type CassiopeiaSubscription,
} from './types'

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

  let deferCancellationIdentifier: number | undefined

  const unsubscribe = machine.subscribe((state) => {
    if (state.action.type === CassiopeiaStateMachineAction.Update) {
      if (state.context.updateIsAsync) {
        deferCancellationIdentifier ??= context.defer(() => {
          deferCancellationIdentifier = undefined
          machine.do(CassiopeiaStateMachineAction.Reduce)
        })
      } else {
        if (deferCancellationIdentifier !== undefined) {
          context.deferCancel(deferCancellationIdentifier)
          deferCancellationIdentifier = undefined
        }

        machine.do(CassiopeiaStateMachineAction.Reduce)
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

  function machineActionUpdate(
    updateIsAsync: true,
    updateType: CassiopeiaStateMachineActionUpdateType,
    updateGenerator?: () => CassiopeiaGenerator,
    updateReducerKeys?: readonly string[],
  ): Promise<void>
  function machineActionUpdate(
    updateIsAsync: false,
    updateType: CassiopeiaStateMachineActionUpdateType,
    updateGenerator?: () => CassiopeiaGenerator,
    updateReducerKeys?: readonly string[],
  ): void
  function machineActionUpdate(
    updateIsAsync: boolean,
    updateType: CassiopeiaStateMachineActionUpdateType,
    updateGenerator?: () => CassiopeiaGenerator,
    updateReducerKeys?: readonly string[],
  ): Promise<void> | void {
    const commit = () => {
      updateOptions.updateType = updateType
      updateOptions.updateGenerator = updateGenerator
      updateOptions.updateIsAsync = updateIsAsync
      updateOptions.updateReducerKeys = updateReducerKeys

      machine.do(CassiopeiaStateMachineAction.Update, updateOptions)
    }

    return updateIsAsync
      ? new Promise<void>((resolve) => {
          updateCallbacks.push(resolve)
          commit()
        })
      : commit()
  }

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
        true,
        CassiopeiaStateMachineActionUpdateType.Generator,
        updateGenerator,
      ),
    updateSync: (updateGenerator) =>
      machineActionUpdate(false, CassiopeiaStateMachineActionUpdateType.Generator, updateGenerator),
    use: (...values) => {
      for (const plugin of values) {
        const install = plugin[CASSIOPEIA_PLUGIN]

        if (!plugins.has(plugin)) {
          const update: CassiopeiaReducerUpdate = async (keys) =>
            await machineActionUpdate(
              true,
              CassiopeiaStateMachineActionUpdateType.Reducer,
              undefined,
              keys ?? reducerKeys,
            )

          const updateSync: CassiopeiaReducerUpdateSync = (keys) =>
            machineActionUpdate(
              false,
              CassiopeiaStateMachineActionUpdateType.Reducer,
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
