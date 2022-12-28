import { STORE } from './constants'

export type Iterator = Generator<undefined, string | undefined, string | true>
export type Iterators = Map<string, () => Iterator>

export type Register = (update: () => void) => void
export type Deregister = () => void

export type Plugin = (iterators: Iterators) => {
  register: Register
  deregister: Deregister
}

export interface Options {
  id?: string
  plugins: Plugin[]
  [key: string]: unknown
}

export type Matcher = Generator<undefined, string | undefined, true | undefined>
export type Variables = Generator<
  [string, string, string],
  void,
  true | undefined
>

export const enum TypeState {
  Inactive,
  Activating,
  Active
}

export interface Store {
  state: TypeState
  id: string
  iterators: Iterators
}

export interface Cassiopeia {
  [STORE]: Store
  start: () => void
  stop: () => void
  update: () => void
  isActive: () => boolean
}
