import { inject, onScopeDispose, getCurrentScope } from 'vue'
import { CASSIOPEIA_VUE_SYMBOL } from './constants'
import type { UseCassiopeia } from './types'

export const useCassiopeia = (): UseCassiopeia => {
  const cassiopeia = inject(
    CASSIOPEIA_VUE_SYMBOL,
    __BROWSER__ ? window.__CASSIOPEIA_VUE__ : undefined
  )

  if (cassiopeia === undefined) {
    throw new Error('Is vue cassiopeia plugin added?')
  }

  const scope = cassiopeia.createScope()

  if (getCurrentScope() !== undefined) {
    onScopeDispose(scope.dispose)
  }

  const update: (typeof cassiopeia)['update'] = async (
    isAsync?: boolean | undefined
  ): Promise<boolean> => {
    // we update only in browser, on SSR renderToString performs the update.
    return await (__BROWSER__
      ? cassiopeia.update(isAsync)
      : Promise.resolve(false))
  }

  return {
    update,
    ...scope
  }
}
