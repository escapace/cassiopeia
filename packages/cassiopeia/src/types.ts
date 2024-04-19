import type { PLUGIN, STORE } from './constants'

export const enum TypeAction {
  UpdatePlugin,
  UpdateSource
}

export const enum TypeState {
  Locked,
  None,
  Scheduled,
  Running
}

export interface StyleSheetPartial {
  [key: string]: number | string | undefined
  content: string
}

export interface StyleSheet extends StyleSheetPartial {
  key: number
  name: string
}

export type Iterator = Generator<
  undefined,
  StyleSheetPartial | StyleSheetPartial[] | undefined,
  string | true
>
export type Iterators = Map<string, () => Iterator>

export type Cache = Set<[string, string, string]>

export type Variables = Generator<
  [string, string, string],
  void,
  true | undefined
>

export type MatcherReturn = StyleSheet[] | undefined

export type Matcher = Generator<undefined, MatcherReturn, true | undefined>

export type UpdatePlugin = (isAsync?: boolean) => Promise<boolean>

export type UpdateSource = (
  createVariables: (() => Variables) | undefined,
  isAsync?: boolean
) => Promise<boolean>

export interface Plugin {
  [PLUGIN]: (iterators: Iterators, update: UpdatePlugin) => void
}

export interface Options {
  plugins: Plugin[]
  rate?: number
}

export interface ActionUpdatePlugin {
  isAsync: boolean
  type: TypeAction.UpdatePlugin
}

export interface ActionUpdateSource {
  createVariables?: () => Variables
  isAsync: boolean
  type: TypeAction.UpdateSource
}

export type Action = ActionUpdatePlugin | ActionUpdateSource

export type Unsubscribe = () => void
export type Subscription = (stylesheets: StyleSheet[]) => void

export interface Store extends Required<Pick<Options, 'rate'>> {
  cache: Cache
  iterators: Iterators
  log: Action[]
  matcher?: Matcher
  state: TypeState
  subscriptions: Set<Subscription>
}

export interface CassiopeiaInstance {
  [STORE]: Store
}

export interface Cassiopeia extends CassiopeiaInstance {
  subscribe: (subscription: Subscription) => Unsubscribe
  update: UpdateSource
}
