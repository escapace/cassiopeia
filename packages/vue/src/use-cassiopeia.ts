import { getCurrentScope, inject, onScopeDispose } from 'vue'
import { CASSIOPEIA_INJECTION_KEY } from './constants'
import type { UseCassiopeia } from './types'

export const useCassiopeia = (): UseCassiopeia => {
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

  const update: (typeof cassiopeia)['update'] = async (isAsync?: boolean): Promise<boolean> =>
    // we update only in browser, on SSR renderToString performs the update.
    await (__PLATFORM__ === 'browser' ? cassiopeia.update(isAsync) : Promise.resolve(false))

  return {
    update,
    ...scope,
  }
}
