/* eslint-disable @typescript-eslint/method-signature-style */

import {
  STORE,
  type Cassiopeia as _Cassiopeia,
  type CassiopeiaInstance,
  type Options as CassiopeiaOptions
} from 'cassiopeia'
import { type Plugin } from 'vue'

export interface CassiopeiaScope {
  add(variable: string[]): string[]
  add(variable: string): string
  clear: () => void
  delete: (variable: string | string[]) => void
  dispose: () => void
}

export interface Cassiopeia {
  [STORE]: _Cassiopeia[typeof STORE]
  subscribe: _Cassiopeia['subscribe']
  createScope: () => CassiopeiaScope
  /**
   * Returns true if the update was successful, i.e. not canceled.
   */
  update: (isAsync?: boolean) => Promise<boolean>
}

export interface UseCassiopeia extends CassiopeiaScope {
  /**
   * Returns true if the update was successful, i.e. not canceled.
   */
  update: (isAsync?: boolean) => Promise<boolean>
}

export type CassiopeiaPlugin = Plugin &
  CassiopeiaInstance & {
    subscribe: _Cassiopeia['subscribe']
    update: Cassiopeia['update']
  }

export interface Options extends Omit<CassiopeiaOptions, 'source'> {}
