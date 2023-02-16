import { SOURCE, STORE } from './constants'

export interface StyleSheetPartial {
  content: string
  [key: string]: string | undefined
}

export interface StyleSheet extends StyleSheetPartial {
  key: string
  content: string
}

export type Iterator = Generator<
  undefined,
  StyleSheetPartial | StyleSheetPartial[] | undefined,
  string | true
>
export type Iterators = Map<string, () => Iterator>

export type Register = (update: (isAsync?: boolean) => void) => void
export type Deregister = () => void

export interface Plugin {
  plugin: (iterators: Iterators) => {
    register: Register
    deregister: Deregister
  }
}

export interface Options {
  source?: Source
  plugins: Plugin[]
}

export type Matcher = Generator<undefined, StyleSheet[], true | undefined>
export type Variables = Generator<
  [string, string, string],
  void,
  true | undefined
>

export enum TypeState {
  Inactive,
  Activating,
  Active
}

export type VariablesCache = Set<[string, string, string]>

export const enum TypeUpdate {
  Locked,
  None,
  Scheduled,
  Running
}

export type Unsubscribe = () => void
export type Subscription = (stylesheets: StyleSheet[]) => void

export type Update = (
  createVariables: (() => Variables) | undefined,
  isAsync?: boolean
) => void

export interface Store {
  cache: VariablesCache
  iterators: Iterators
  matcher?: Matcher
  state: TypeState
  subscriptions: Set<Subscription>
  update: TypeUpdate
}

export interface Cassiopeia {
  [STORE]: Store
  subscribe: (subscription: Subscription) => Unsubscribe
  start: () => void
  stop: () => void
  update: Update
  isActive: () => boolean
}

export type Source = (
  store: Store,
  update: Update
) => {
  [SOURCE]: {
    start: () => void
    stop?: () => void
  }
}
