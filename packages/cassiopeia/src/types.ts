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
  [key: string]: number | string | undefined
  content: string
  media?: string
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

/** Update function that accepts optional generator factory for custom property source changes */
export type CassiopeiaGeneratorUpdate = (
  createGenerator?: () => CassiopeiaGenerator,
) => Promise<void>

/** Update function that accepts optional reducer keys for targeted plugin updates */
export type CassiopeiaReducerUpdate = (keys?: string[]) => Promise<void>

export interface CassiopeiaPluginContext {
  /** Cleanup function to remove plugin and trigger update */
  dispose: () => Promise<void>
  /** Proxy for registering reducer factory functions with automatic change detection */
  reducerFactories: CassiopeiaReducerFactories
  /** Read-only array of currently registered reducer keys */
  reducerKeys: readonly string[]
  /** Trigger async reducer-only update for this plugin's keys */
  update: CassiopeiaReducerUpdate
  /** Trigger synchronous reducer-only update for this plugin's keys */
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
  /** No active processing, awaiting next update */
  Idle,
  /** Update received, preparing for orchestrator execution */
  PreFlight,
  /** Orchestrator actively processing stylesheets */
  InFlight,
}

export enum CassiopeiaStateMachineAction {
  /** Complete current operation and return to idle state */
  Done,
  /** Execute orchestrator to coordinate reducers and generate stylesheets */
  Reduce,
  /** Initiate new generator or reducer update cycle */
  Update,
}

export enum CassiopeiaStateMachineActionUpdateType {
  None = 0,

  /** Update involves generator changes (new custom property sources) */
  Generator = 1 << 0,
  /** Update involves reducer changes (plugin modifications) */
  Reducer = 1 << 1,
  /** Update involves both generator and reducer changes */
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
