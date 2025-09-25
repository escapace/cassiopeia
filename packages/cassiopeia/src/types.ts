import type { CASSIOPEIA_CONTEXT, CASSIOPEIA_PLUGIN, CASSIOPEIA_STATE } from './constants'
import type { CachedIterable } from './create-cached-iterable'
import type {
  TerminatingReducer,
  TerminatingReducerCancel,
  TerminatingReducerFactories,
  TerminatingReducers,
} from './create-terminating-reducers'
import type $ from '@escapace/typelevel'

export interface CassiopeiaPartialStyleSheet {
  [index: string]: number | string | undefined
  content: string
}

export interface CassiopeiaStyleSheet extends CassiopeiaPartialStyleSheet {
  index: number
  key: string
}

export interface CassiopeiaStyleSheets {
  keys: string[]
  values: CassiopeiaStyleSheet[]
}

/**
 * Terminating reducer that coordinates stylesheet collection from multiple custom property processing reducers.
 */
export type CassiopeiaOrchestrator = TerminatingReducer<CassiopeiaStyleSheets, never>
/**
 * Generator that yields custom property key-suffix pairs.
 * Processes CSS custom property references with triple-dash prefixes and extracts
 * the key-suffix segments from the custom property identifier. The triple-dash pattern follows CSS
 * custom property naming conventions but uses an extended prefix for key-based
 * organization. For example, `var(---foo-bar)` yields the pair `['foo', 'bar']`.
 */
export type CassiopeiaGenerator = Generator<
  [string, string],
  undefined,
  TerminatingReducerCancel | undefined
>
/**
 * Terminating reducer that processes custom property key-suffix strings and generates CSS
 * stylesheets. Reduces triple-dash custom properties into stylesheet objects or arrays, with
 * implementation-specific processing logic.
 */
export type CassiopeiaReducer = TerminatingReducer<
  CassiopeiaPartialStyleSheet | CassiopeiaPartialStyleSheet[],
  string
>
/**
 * Factory functions for creating triple-dash custom property processing reducers with lazy
 * initialization.
 */
export type CassiopeiaReducerFactories = TerminatingReducerFactories<
  Record<string, CassiopeiaReducer>
>
/**
 * Cached terminating reducers providing lazy access to triple-dash custom property processing instances.
 */
export type CassiopeiaReducers = TerminatingReducers<Record<string, CassiopeiaReducer>>

export type CassiopeiaGeneratorUpdate = (
  createGenerator?: () => CassiopeiaGenerator,
) => Promise<void>
export type CassiopeiaReducerUpdate = (keys?: string[]) => Promise<void>

export interface CassiopeiaPluginContext {
  dispose: () => void
  reducerFactories: CassiopeiaReducerFactories
  reducerKeys: readonly string[]
  update: CassiopeiaReducerUpdate
  updateSync: CassiopeiaReducerUpdate
}

export interface CassiopeiaPlugin {
  [CASSIOPEIA_PLUGIN]: (context: CassiopeiaPluginContext) => void
}

export type CassiopeiaSubscription = (styleSheets: CassiopeiaStyleSheets) => void
export type CassiopeiaUnsubscribe = () => void

export interface CassiopeiaInstance {
  [CASSIOPEIA_CONTEXT]: CassiopeiaStateMachineContext
  [CASSIOPEIA_STATE]: CassiopeiaStateMachineState
}

export interface Cassiopeia extends CassiopeiaInstance {
  dispose: () => void
  subscribe: (subscription: CassiopeiaSubscription) => CassiopeiaUnsubscribe
  update: CassiopeiaGeneratorUpdate
  updateSync: CassiopeiaGeneratorUpdate
  use: (...plugins: CassiopeiaPlugin[]) => Cassiopeia
}

export enum CassiopeiaStateMachineState {
  Idle,
  PreFlight,
  InFlight,
}

export enum CassiopeiaStateMachineAction {
  Done,
  Reduce,
  Update,
}

export enum CassiopeiaStateMachineActionUpdateType {
  None = 0,

  Generator = 1 << 0,
  Reducer = 1 << 1,
  Both = Generator | Reducer,
}

export interface CassiopeiaStateMachineContext {
  defer: (callback: () => void) => void
  deferEvery: number
  reducers: CassiopeiaReducers

  generator?: CachedIterable<[string, string], undefined>
  orchestrator?: CassiopeiaOrchestrator

  updateIsAsync: boolean
  updateType: CassiopeiaStateMachineActionUpdateType
  updateGenerator?: () => CassiopeiaGenerator
  updateReducerKeys?: string[]
}

export type CassiopeiaStateMachineActionUpdateOptions = $.Prettify<
  {
    updateReducerKeys?: readonly string[]
  } & Partial<Pick<CassiopeiaStateMachineContext, 'updateGenerator'>> &
    Pick<CassiopeiaStateMachineContext, 'updateIsAsync' | 'updateType'>
>
