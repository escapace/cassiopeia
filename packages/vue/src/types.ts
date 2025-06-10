/* eslint-disable typescript/method-signature-style */

import type { Cassiopeia as _Cassiopeia, Plugin } from 'cassiopeia'
import type { MaybeRef, ObjectPlugin } from 'vue'

export interface CassiopeiaScope {
  add(variable: string): string
  add(variable: string[]): string[]
  clear: () => void
  delete: (variable: string | string[]) => void
  dispose: (update?: boolean) => void
}

export interface Cassiopeia extends ObjectPlugin, Omit<_Cassiopeia, 'update' | 'use'> {
  createScope: () => CassiopeiaScope
  /**
   * Returns true if the update was successful, i.e. not canceled.
   */
  dispose: () => void
  update: (isAsync?: boolean) => Promise<boolean>
  use: (...plugins: Plugin[]) => Cassiopeia
}

export interface UseCassiopeia extends CassiopeiaScope {
  /**
   * Returns true if the update was successful, i.e. not canceled.
   */
  update: (isAsync?: boolean) => Promise<boolean>
}

export interface Options {
  /** Defer to the event loop every nth iteration. */
  deferEvery?: MaybeRef<number | undefined>
}
