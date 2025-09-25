import { getCurrentScope, inject, onScopeDispose } from 'vue'
import { CASSIOPEIA_INJECTION_KEY } from './constants'
import type { CassiopeiaScope } from './types'

export const useCassiopeia = (): CassiopeiaScope => {
  const cassiopeia = inject(
    CASSIOPEIA_INJECTION_KEY,
    __PLATFORM__ === 'browser' ? globalThis.__CASSIOPEIA__ : undefined,
  )

  if (cassiopeia === undefined) {
    throw new Error('Is vue cassiopeia plugin added?')
  }

  const scope = cassiopeia.createScope()

  if (getCurrentScope() !== undefined) {
    onScopeDispose(scope.dispose)
  }

  return scope
}
