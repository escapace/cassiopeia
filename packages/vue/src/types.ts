import type {
  Cassiopeia as CassiopeiaCore,
  CassiopeiaScopes,
  CassiopeiaStateMachineContext,
} from 'cassiopeia'
import type { MaybeRef, ObjectPlugin } from 'vue'

export interface Cassiopeia
  extends ObjectPlugin,
    Omit<CassiopeiaCore, 'update' | 'updateSync'>,
    Pick<CassiopeiaScopes, 'createScope' | 'update' | 'updateSync'> {}

export interface CassiopeiaOptions {
  defer?: CassiopeiaStateMachineContext['defer']
  deferCancel?: CassiopeiaStateMachineContext['deferCancel']
  /** Defer to the event loop every nth iteration. */
  deferEvery?: MaybeRef<CassiopeiaStateMachineContext['deferEvery'] | undefined>
}
