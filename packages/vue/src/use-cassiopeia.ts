import { inject, onScopeDispose } from 'vue'
import { CASSIOPEIA_VUE_SYMBOL } from './constants'

export const useCassiopeia = () => {
  const cassiopeia = inject(
    CASSIOPEIA_VUE_SYMBOL,
    __BROWSER__ ? window.__CASSIOPEIA_VUE__ : undefined
  )

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
