/* eslint-disable typescript/method-signature-style */

import type { Cassiopeia as _Cassiopeia, Options as CassiopeiaOptions } from 'cassiopeia'
import type { MaybeRef, ObjectPlugin } from 'vue'

export interface CassiopeiaScope {
  add(variable: string): string
  add(variable: string[]): string[]
  clear: () => void
  delete: (variable: string | string[]) => void
  dispose: () => void
}

export interface Cassiopeia extends Omit<_Cassiopeia, 'update'> {
  createScope: () => CassiopeiaScope
  /**
   * Returns true if the update was successful, i.e. not canceled.
   */
  dispose: () => void
  update: (isAsync?: boolean) => Promise<boolean>
}

export interface UseCassiopeia extends CassiopeiaScope {
  /**
   * Returns true if the update was successful, i.e. not canceled.
   */
  update: (isAsync?: boolean) => Promise<boolean>
}

export interface CassiopeiaPlugin extends Cassiopeia, ObjectPlugin {}

export interface Options extends Omit<CassiopeiaOptions, 'source'> {
  /** Defer to the event loop every nth iteration. */
  deferEvery?: MaybeRef<number | undefined>
}
