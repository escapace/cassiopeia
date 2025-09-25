import {
  CASSIOPEIA_CONTEXT,
  createCassiopeia as createCassiopeiaCore,
  TERMINATING_REDUCER_CANCEL,
  type CassiopeiaGenerator,
} from 'cassiopeia'
import { computed, effectScope as createEffectScope, unref, watch, type App } from 'vue'
import { CASSIOPEIA_INJECTION_KEY, CASSIOPEIA_REGEX } from './constants'
import type { Cassiopeia, CassiopeiaOptions, CassiopeiaScope } from './types'

function* createGenerator(scopes: Set<Set<string>>): CassiopeiaGenerator {
  for (const scope of scopes) {
    for (const string of scope) {
      const match = string.match(CASSIOPEIA_REGEX)

      if (match?.length === 3) {
        const cancelled = yield match.splice(1) as [string, string]

        if (cancelled === TERMINATING_REDUCER_CANCEL) {
          return
        }
      }
    }
  }
}

export const createCassiopeia = (options: CassiopeiaOptions = {}): Cassiopeia => {
  if (__PLATFORM__ === 'browser') {
    if (globalThis.__CASSIOPEIA__ !== undefined) {
      return globalThis.__CASSIOPEIA__
    }
  }

  const core = createCassiopeiaCore()
  const scopes = new Set<Set<string>>()
  const createVariables = () => createGenerator(scopes)

  const effectScope = createEffectScope(true)
  effectScope.run(() => {
    const deferEvery = computed(() => unref(options.deferEvery))
    const defer = computed(() => unref(options.defer))

    watch(
      defer,
      (defer) => {
        if (typeof defer === 'function') {
          core[CASSIOPEIA_CONTEXT].defer = defer
        }
      },
      { immediate: true },
    )

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

  const update = async () => await core.update(createVariables)
  const updateSync = async () => await core.updateSync(createVariables)

  const createScope = (): CassiopeiaScope => {
    const scope = new Set<string>()
    scopes.add(scope)

    function add(value: string): string
    function add(value: string[]): string[]
    function add(value: string | string[]): string | string[] {
      ;(Array.isArray(value) ? value : [value]).forEach((value) => {
        if (!scope.has(value)) {
          scope.add(value)
        }
      })

      return value
    }

    const clear = () => scope.clear()

    const dispose = (triggerUpdate = true) => {
      clear()

      if (triggerUpdate && scopes.delete(scope)) {
        void update()
      }
    }

    const del = (value: string | string[]) => {
      ;(Array.isArray(value) ? value : [value]).forEach((value) => {
        scope.delete(value)
      })
    }

    return { add, clear, delete: del, dispose, update, updateSync }
  }

  const cassiopeia: Cassiopeia = {
    ...core,
    createScope,
    dispose: () => {
      effectScope.stop()
      scopes.clear()

      if (__PLATFORM__ === 'browser') {
        globalThis.__CASSIOPEIA__ = undefined
      }
      core.dispose()
    },
    install: (app: App) => {
      app.provide(CASSIOPEIA_INJECTION_KEY, cassiopeia)
      app.onUnmount(cassiopeia.dispose)
    },
    update,
    updateSync,
  }

  if (__PLATFORM__ === 'browser') {
    globalThis.__CASSIOPEIA__ = cassiopeia
  }

  return cassiopeia
}
