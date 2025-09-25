/* eslint-disable typescript/method-signature-style */

import type { Cassiopeia as CassiopeiaCore } from 'cassiopeia'
import type { MaybeRef, ObjectPlugin } from 'vue'

export interface CassiopeiaScope extends Pick<CassiopeiaCore, 'update' | 'updateSync'> {
  add(variable: string): string
  add(variable: string[]): string[]
  clear: () => void
  delete: (variable: string | string[]) => void
  dispose: (update?: boolean) => void
}

export interface Cassiopeia extends CassiopeiaCore, ObjectPlugin {
  createScope: () => CassiopeiaScope
  /**
   * Returns true if the update was successful, i.e. not canceled.
   */
  dispose: () => void
}

export interface CassiopeiaOptions {
  defer?: MaybeRef<((callback: () => void) => void) | undefined>
  /** Defer to the event loop every nth iteration. */
  deferEvery?: MaybeRef<number | undefined>
}
