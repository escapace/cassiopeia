/* eslint-disable typescript/method-signature-style */

import type { Cassiopeia as CassiopeiaCore, CassiopeiaStateMachineContext } from 'cassiopeia'
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
}

export interface CassiopeiaOptions {
  defer?: CassiopeiaStateMachineContext['defer']
  deferCancel?: CassiopeiaStateMachineContext['deferCancel']
  /** Defer to the event loop every nth iteration. */
  deferEvery?: MaybeRef<CassiopeiaStateMachineContext['deferEvery'] | undefined>
}
