import { STORE } from './constants'

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
  content: string
  [key: string]: string | number | undefined
}

export interface StyleSheet extends StyleSheetPartial {
  name: string
  key: number
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

export type Matcher = Generator<
  undefined,
  undefined | { accumulator: StyleSheet[]; cache?: Cache },
  true | undefined
>

export type UpdatePlugin = (isAsync?: boolean) => Promise<boolean>

export type UpdateSource = (
  createVariables: (() => Variables) | undefined,
  isAsync?: boolean
) => Promise<boolean>

export interface Plugin {
  plugin: (iterators: Iterators, update: UpdatePlugin) => void
}

export interface Options {
  plugins: Plugin[]
}

export interface ActionUpdatePlugin {
  type: TypeAction.UpdatePlugin
  isAsync: boolean
}

export interface ActionUpdateSource {
  type: TypeAction.UpdateSource
  createVariables?: () => Variables
  isAsync: boolean
}

export type ActionUpdate = ActionUpdatePlugin | ActionUpdateSource

export type Unsubscribe = () => void
export type Subscription = (stylesheets: StyleSheet[]) => void

export interface Store {
  log: ActionUpdate[]
  cache: Cache
  iterators: Iterators
  matcher?: Matcher
  subscriptions: Set<Subscription>
  state: TypeState
}

export interface CassiopeiaInstance {
  [STORE]: Store
}

export interface Cassiopeia extends CassiopeiaInstance {
  subscribe: (subscription: Subscription) => Unsubscribe
  update: UpdateSource
}
