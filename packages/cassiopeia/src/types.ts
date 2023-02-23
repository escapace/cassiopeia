import { STORE } from './constants'

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

export type Register = () => void

export interface Plugin {
  plugin: (iterators: Iterators, update: (isAsync?: boolean) => void) => void
}

export interface Options {
  plugins: Plugin[]
}

export type Matcher = Generator<
  undefined,
  undefined | { accumulator: StyleSheet[]; cache?: Cache },
  true | undefined
>
export type Variables = Generator<
  [string, string, string],
  void,
  true | undefined
>

export const enum TypeState {
  Locked,
  None,
  Scheduled,
  Running
}

export type Unsubscribe = () => void
export type Subscription = (stylesheets: StyleSheet[]) => void

export const enum TypeUpdate {
  Plugin,
  Source
}

export interface UpdatePlugin {
  type: TypeUpdate.Plugin
  isAsync: boolean
}

export interface UpdateSource {
  type: TypeUpdate.Source
  createVariables?: () => Variables
  isAsync: boolean
}

export type Update = UpdatePlugin | UpdateSource

export type Cache = Set<[string, string, string]>

export interface Store {
  log: Update[]
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
  update: (
    createVariables: (() => Variables) | undefined,
    isAsync?: boolean
  ) => void
}
