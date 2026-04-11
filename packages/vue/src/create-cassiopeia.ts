import {
  CASSIOPEIA_CONTEXT,
  CASSIOPEIA_STATE,
  createCassiopeia as createCassiopeiaCore,
  CassiopeiaScopes,
} from 'cassiopeia'
import { computed, effectScope as createEffectScope, unref, watch, type App } from 'vue'
import { CASSIOPEIA_INJECTION_KEY } from './constants'
import type { Cassiopeia, CassiopeiaOptions } from './types'

export const createCassiopeia = (options: CassiopeiaOptions = {}): Cassiopeia => {
  if (__PLATFORM__ === 'browser') {
    if (globalThis.__CASSIOPEIA__ !== undefined) {
      return globalThis.__CASSIOPEIA__
    }
  }

  const core = createCassiopeiaCore()
  const scopes = new CassiopeiaScopes(core)

  const effectScope = createEffectScope(true)
  effectScope.run(() => {
    const deferEvery = computed(() => unref(options.deferEvery))
    const defer = unref(options.defer)
    const deferCancel = unref(options.deferCancel)

    if (defer !== undefined && deferCancel !== undefined) {
      core[CASSIOPEIA_CONTEXT].defer = defer
      core[CASSIOPEIA_CONTEXT].deferCancel = deferCancel
    }

    watch(
      deferEvery,
      (deferEvery) => {
        if (Number.isInteger(deferEvery) && deferEvery! > 0) {
          core[CASSIOPEIA_CONTEXT].deferEvery = deferEvery!
        }
      },
      { immediate: true },
    )
  })

  const cassiopeia: Cassiopeia = {
    ...core,
    get [CASSIOPEIA_STATE]() {
      return core[CASSIOPEIA_STATE]
    },
    dispose: async () => {
      effectScope.stop()
      scopes.dispose()

      if (__PLATFORM__ === 'browser') {
        globalThis.__CASSIOPEIA__ = undefined
      }
      await core.dispose()
    },
    install: (app: App) => {
      app.provide(CASSIOPEIA_INJECTION_KEY, cassiopeia)
      app.onUnmount(() => void cassiopeia.dispose())
    },

    createScope: scopes.createScope,
    update: scopes.update,
    updateSync: scopes.updateSync,
  }

  if (__PLATFORM__ === 'browser') {
    globalThis.__CASSIOPEIA__ = cassiopeia
  }

  return cassiopeia
}
