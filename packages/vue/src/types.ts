/* eslint-disable @typescript-eslint/method-signature-style */

import {
  STORE,
  type Cassiopeia,
  type CassiopeiaInstance,
  type Options as CassiopeiaOptions
} from 'cassiopeia'
import { type Plugin } from 'vue'

export interface CassiopeiaScope {
  [STORE]: Cassiopeia[typeof STORE]
  subscribe: Cassiopeia['subscribe']
  createScope: () => {
    add(variable: string[]): string[]
    add(variable: string): string
    clear: () => void
    delete: (variable: string | string[]) => void
    dispose: () => void
  }
  update: (isAsync?: boolean) => void
}

export type CassiopeiaPlugin = Plugin &
  CassiopeiaInstance & {
    subscribe: Cassiopeia['subscribe']
    update: CassiopeiaScope['update']
  }

export interface Options extends Omit<CassiopeiaOptions, 'source'> {}
