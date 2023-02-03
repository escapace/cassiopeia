import { SOURCE, STORE } from './constants'

export type Iterator = Generator<undefined, string | undefined, string | true>
export type Iterators = Map<string, () => Iterator>

export type Register = (update: () => void) => void
export type Deregister = () => void

export type Plugin = (iterators: Iterators) => {
  register: Register
  deregister: Deregister
}

export interface Options {
  source: Source
  plugins: Plugin[]
}

export type Matcher = Generator<undefined, string | undefined, true | undefined>
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
export type Subscription = (value: string) => void

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
  update: () => void
  isActive: () => boolean
}

export type Source = (
  store: Store,
  update: (createVariables: () => Variables) => void
) => {
  [SOURCE]: {
    start: () => void
    stop?: () => void
  }
}
