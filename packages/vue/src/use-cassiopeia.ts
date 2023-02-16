import { inject, onScopeDispose } from 'vue'
import { INJECTION_KEY_CASSIOPEIA } from './constants'

export const useCassiopeia = () => {
  const cassiopeia = inject(INJECTION_KEY_CASSIOPEIA)

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
