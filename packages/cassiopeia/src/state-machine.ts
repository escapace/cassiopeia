import { stateMachine as createStateMachine } from '@escapace/fsm'
import { createCachedIterable } from './create-cached-iterable'
import { TERMINATING_REDUCER_CANCEL } from './create-terminating-reducers'
import {
  CassiopeiaStateMachineAction,
  CassiopeiaStateMachineActionUpdateType,
  CassiopeiaStateMachineState,
  type CassiopeiaStateMachineActionUpdateOptions,
  type CassiopeiaStateMachineContext,
} from './types'
import { createOrchestrator } from './create-orchestrator'

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
  .context<CassiopeiaStateMachineContext>(
    () =>
      ({
        defer: setTimeout,
        deferEvery: 8,
        updateIsAsync: true,
        updateType: CassiopeiaStateMachineActionUpdateType.None,
      }) satisfies Omit<
        CassiopeiaStateMachineContext,
        'reducers'
      > as unknown as CassiopeiaStateMachineContext,
  )

  .transition(
    [
      CassiopeiaStateMachineState.Idle,
      CassiopeiaStateMachineState.InFlight,
      CassiopeiaStateMachineState.PreFlight,
    ],
    [CassiopeiaStateMachineAction.Update],
    CassiopeiaStateMachineState.PreFlight,
    (context, { payload }) => {
      context.updateIsAsync = payload.updateIsAsync
      context.orchestrator?.next(TERMINATING_REDUCER_CANCEL)
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
        context.generator?.[TERMINATING_REDUCER_CANCEL]()
        context.generator = undefined
        context.updateGenerator = payload.updateGenerator
      }

      if (updateType === CassiopeiaStateMachineActionUpdateType.Reducer) {
        const updateReducerKeys = payload.updateReducerKeys

        if (updateReducerKeys !== undefined && updateReducerKeys.length !== 0) {
          const contextReducerKeys = (context.updateReducerKeys ??= [])

          for (const updateReducerKey of updateReducerKeys) {
            if (!contextReducerKeys.includes(updateReducerKey)) {
              contextReducerKeys.push(updateReducerKey)
            }
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
      (value) => value.updateGenerator !== undefined || value.generator !== undefined,
    ],
    CassiopeiaStateMachineState.InFlight,
    (context) => {
      const { generator, updateGenerator } = context

      if (generator === undefined && updateGenerator !== undefined) {
        context.generator = createCachedIterable(updateGenerator)
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
    [CassiopeiaStateMachineAction.Done],
    CassiopeiaStateMachineState.Idle,
    (context) => {
      context.orchestrator = undefined
      context.updateType = CassiopeiaStateMachineActionUpdateType.None
      context.updateGenerator = undefined
      if (context.updateReducerKeys !== undefined) {
        context.updateReducerKeys.length = 0
      }

      return context
    },
  )
