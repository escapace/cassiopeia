import { interpret } from '@escapace/fsm'
import { remove } from 'coastal'
import {
  CASSIOPEIA_CONTEXT,
  CASSIOPEIA_PLUGIN,
  CASSIOPEIA_STATE,
  CassiopeiaStateMachineAction,
  CassiopeiaStateMachineActionUpdateType,
} from './constants'
import { createScheduler } from './create-scheduler'
import { createTerminatingReducerFactoriesProxy } from './create-terminating-reducers'
import { stateMachine } from './state-machine'
import type {
  Cassiopeia,
  CassiopeiaGenerator,
  CassiopeiaPlugin,
  CassiopeiaPluginContext,
  CassiopeiaReducerUpdate,
  CassiopeiaReducerUpdateSync,
  CassiopeiaStateMachineActionUpdateOptions,
  CassiopeiaSubscription,
} from './types'

export function createCassiopeia(): Cassiopeia {
  const subscriptions: CassiopeiaSubscription[] = []
  const plugins = new Map<CassiopeiaPlugin, CassiopeiaPluginContext>()
  const machine = interpret(stateMachine)
  const { context } = machine

  const updateCallbacks: Array<() => void> = []

  let deferCancellationIdentifier: number | undefined

  machine.subscribe(({ action }) => {
    const actionType = action.type

    if (actionType === CassiopeiaStateMachineAction.Update) {
      if (context.updateIsAsync) {
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
    } else if (actionType === CassiopeiaStateMachineAction.Reduce) {
      if (__PLATFORM__ === 'node') {
        machine.do(CassiopeiaStateMachineAction.Done)
      } else if (context.orchestrator === undefined) {
        // Optimization path: when state machine skips orchestrator creation due to
        // no plugins registered or empty update reducer keys, notify subscriptions
        // with empty values to maintain consistent behavior
        for (const subscription of subscriptions) {
          subscription(context.reducerKeys, [])
        }

        machine.do(CassiopeiaStateMachineAction.Done)
      } else {
        const values = createScheduler(context)

        if (values instanceof Promise) {
          void Promise.resolve(values).then((values) => {
            if (values !== undefined) {
              for (const subscription of subscriptions) {
                subscription(context.reducerKeys, values)
              }

              machine.do(CassiopeiaStateMachineAction.Done)
            }
          })
        } else if (values !== undefined) {
          for (const subscription of subscriptions) {
            subscription(context.reducerKeys, values)
          }

          machine.do(CassiopeiaStateMachineAction.Done)
        }
      }
    } else {
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
    updateReducerKeys?: Iterable<string>,
  ): Promise<void>
  function machineActionUpdate(
    updateIsAsync: false,
    updateType: CassiopeiaStateMachineActionUpdateType,
    updateGenerator?: () => CassiopeiaGenerator,
    updateReducerKeys?: Iterable<string>,
  ): void
  function machineActionUpdate(
    updateIsAsync: boolean,
    updateType: CassiopeiaStateMachineActionUpdateType,
    updateGenerator?: () => CassiopeiaGenerator,
    updateReducerKeys?: Iterable<string>,
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

  const dispose = async () => {
    subscriptions.length = 0

    for (const metadata of plugins.values()) {
      await metadata.dispose()
    }

    machine.do(CassiopeiaStateMachineAction.Reset)
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

          const pluginContext: CassiopeiaPluginContext = {
            update,
            updateSync,
            ...createTerminatingReducerFactoriesProxy(context.reducerFactories, {
              onDelete: (key) => {
                context.reducerKeys.delete(key)
                void update()
              },
              onDispose: (keys) => {
                for (const key of keys) {
                  context.reducerKeys.delete(key)
                }
                // reducerKeys are not cleared by dispose()
                keys.clear()
                plugins.delete(plugin)
                return update()
              },
              onSet: (key) => {
                context.reducerKeys.add(key)
                void update()
              },
            }),
          }
          const { reducerKeys } = pluginContext

          plugins.set(plugin, pluginContext)
          install(pluginContext)
        }
      }

      return cassiopeia
    },
  }

  return cassiopeia
}
