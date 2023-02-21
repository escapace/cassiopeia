/* eslint-disable no-var */
import { inject, onScopeDispose } from 'vue'
import { CASSIOPEIA_VUE_SYMBOL } from './constants'
import type { CassiopeiaScope } from './types'

declare global {
  /* eslint-disable @typescript-eslint/naming-convention */
  var __CASSIOPEIA_VUE__: CassiopeiaScope | undefined
}

export const useCassiopeia = () => {
  const cassiopeia =
    inject(CASSIOPEIA_VUE_SYMBOL) ?? globalThis.__CASSIOPEIA_VUE__

  if (cassiopeia === undefined) {
    throw new Error('Is vue cassiopeia plugin added?')
  }

  const scope = cassiopeia.createScope()

  onScopeDispose(scope.dispose)

  return {
    update: cassiopeia.update,
    ...scope
  }
}
