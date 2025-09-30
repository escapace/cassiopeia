import { stateMachine as createStateMachine } from '@escapace/fsm'
import {
  CASSIOPEIA_CANCEL,
  CassiopeiaStateMachineAction,
  CassiopeiaStateMachineActionUpdateType,
  CassiopeiaStateMachineState,
} from './constants'
import { createCachedIterable } from './create-cached-iterable'
import { createOrchestrator } from './create-orchestrator'
import type {
  CassiopeiaStateMachineActionUpdateOptions,
  CassiopeiaStateMachineContext,
} from './types'

export const stateMachine = createStateMachine()
  .state(CassiopeiaStateMachineState.Idle)
  .state(CassiopeiaStateMachineState.InFlight)
  .state(CassiopeiaStateMachineState.PreFlight)
  .initial(CassiopeiaStateMachineState.Idle)
  .action<CassiopeiaStateMachineAction.Update, CassiopeiaStateMachineActionUpdateOptions>(
    CassiopeiaStateMachineAction.Update,
  )
  .action<CassiopeiaStateMachineAction.Reduce>(CassiopeiaStateMachineAction.Reduce)
  .action<CassiopeiaStateMachineAction.Done>(CassiopeiaStateMachineAction.Done)
  .action<CassiopeiaStateMachineAction.Reset>(CassiopeiaStateMachineAction.Reset)
  .context<CassiopeiaStateMachineContext>(() => ({
    defer: setTimeout.bind(globalThis),
    deferCancel: clearTimeout.bind(globalThis),
    deferEvery: 8,
    reducerFactories: {},
    reducerKeys: new Set(),
    updateIsAsync: true,
    updateType: CassiopeiaStateMachineActionUpdateType.None,
  }))

  .transition(
    [
      CassiopeiaStateMachineState.Idle,
      CassiopeiaStateMachineState.InFlight,
      CassiopeiaStateMachineState.PreFlight,
    ],
    CassiopeiaStateMachineAction.Update,
    CassiopeiaStateMachineState.PreFlight,
    (context, { payload }) => {
      context.updateIsAsync = payload.updateIsAsync
      context.orchestrator?.next(CASSIOPEIA_CANCEL)
      context.orchestrator = undefined

      const updateType: CassiopeiaStateMachineActionUpdateType = (context.updateType |=
        payload.updateType)

      // Cache preservation optimization: only invalidate existing generator cache when both
      // a new generator is actually provided (payload.updateGenerator !== undefined) AND
      // updateType includes CustomPropertiesGenerator flag. This preserves the existing
      // cached generator for reducer-only updates and empty generator updates, avoiding
      // unnecessary cache invalidation and createCachedIterable calls.
      if (
        payload.updateGenerator !== undefined &&
        (updateType & CassiopeiaStateMachineActionUpdateType.Generator) !== 0
      ) {
        context.generator?.[CASSIOPEIA_CANCEL]()
        context.generator = undefined
        context.updateGenerator = payload.updateGenerator
      }

      if (updateType === CassiopeiaStateMachineActionUpdateType.Reducer) {
        const { reducerKeys } = context
        const updateReducerKeys = payload.updateReducerKeys!

        let contextUpdateReducerKeys: Set<string>

        if (context.updateReducerKeys === undefined) {
          contextUpdateReducerKeys = context.updateReducerKeys = new Set()
        } else {
          contextUpdateReducerKeys = context.updateReducerKeys

          // Cleanup: remove obsolete keys from updateReducerKeys when plugins have been disposed/deleted.
          // This ensures updateReducerKeys only contains keys for currently registered plugins.
          for (const key of contextUpdateReducerKeys) {
            if (!reducerKeys.has(key)) {
              contextUpdateReducerKeys.delete(key)
            }
          }
        }

        // TODO: in the future https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/intersection
        for (const key of updateReducerKeys) {
          if (reducerKeys.has(key)) {
            contextUpdateReducerKeys.add(key)
          }
        }
      } else {
        context.updateReducerKeys = undefined
      }

      return context
    },
  )

  .transition(
    CassiopeiaStateMachineState.PreFlight,
    [
      CassiopeiaStateMachineAction.Reduce,
      (context) => context.updateGenerator !== undefined || context.generator !== undefined,
    ],
    CassiopeiaStateMachineState.InFlight,
    (context) => {
      const { generator, updateGenerator } = context

      if (generator === undefined && updateGenerator !== undefined) {
        context.generator = createCachedIterable(updateGenerator)
      }

      // Performance optimization: early return when no processing is required.
      // This avoids expensive orchestrator creation, generator iteration, and reducer execution
      // when the result would be empty anyway. Two conditions trigger this optimization:
      // - No plugins registered: when reducerFactories is empty, no plugins exist to process
      // - Empty update reducer keys: when updateReducerKeys is empty, no reducers need processing
      if (context.reducerKeys.size === 0 || context.updateReducerKeys?.size === 0) {
        return context
      }

      if (__PLATFORM__ === 'browser') {
        context.orchestrator = createOrchestrator(context)
        context.orchestrator.next()
      }

      return context
    },
  )

  .transition(
    CassiopeiaStateMachineState.InFlight,
    CassiopeiaStateMachineAction.Done,
    CassiopeiaStateMachineState.Idle,
    (context) => {
      context.orchestrator = undefined
      context.updateType = CassiopeiaStateMachineActionUpdateType.None
      context.updateGenerator = undefined
      context.updateReducerKeys = undefined

      return context
    },
  )

  .transition(
    [
      CassiopeiaStateMachineState.Idle,
      CassiopeiaStateMachineState.PreFlight,
      CassiopeiaStateMachineState.InFlight,
    ],
    CassiopeiaStateMachineAction.Reset,
    CassiopeiaStateMachineState.Idle,
    (context) => {
      context.orchestrator?.next(CASSIOPEIA_CANCEL)
      context.orchestrator = undefined
      context.generator?.[CASSIOPEIA_CANCEL]()
      context.generator = undefined
      context.updateGenerator = undefined
      context.reducerKeys.clear()
      context.updateReducerKeys = undefined
      context.updateIsAsync = true

      return context
    },
  )
