/* eslint-disable typescript/no-non-null-assertion */
import { createCassiopeia as _cassiopeia, STORE, type Variables } from 'cassiopeia'
import { computed, effectScope, toValue, watch, type App } from 'vue'
import { CASSIOPEIA_VUE_SYMBOL, REGEX } from './constants'
import type { Cassiopeia, CassiopeiaPlugin, CassiopeiaScope, Options } from './types'

function* createVariableIterator(sets: Set<Set<string>>): Variables {
  for (const set of sets) {
    for (const string of set) {
      const match = string.match(REGEX)

      if (match?.length === 3) {
        const cancelled = yield match.splice(1) as [string, string]

        if (cancelled) {
          return
        }
      }
    }
  }
}

const createCassiopeiaVue = (options: Options): Cassiopeia => {
  if (__PLATFORM__ === 'browser') {
    if (globalThis.__CASSIOPEIA_VUE__ !== undefined) {
      return globalThis.__CASSIOPEIA_VUE__
    }
  }

  const scope = effectScope(true)

  const sets = new Set<Set<string>>()

  const createVariables = () => createVariableIterator(sets)

  const cassiopeia = _cassiopeia({ ...options })

  scope.run(() => {
    const deferEvery = computed(() => toValue(options.deferEvery))

    watch(
      deferEvery,
      (deferEvery) => {
        if (Number.isInteger(deferEvery) && deferEvery! > 0) {
          cassiopeia[STORE].deferEvery = deferEvery!
        }
      },
      { immediate: true },
    )
  })

  const update = async (isAsync?: boolean) => await cassiopeia.update(createVariables, isAsync)

  const createScope = (): CassiopeiaScope => {
    const set = new Set<string>()
    sets.add(set)

    function add(value: string): string
    function add(value: string[]): string[]
    function add(value: string | string[]): string | string[] {
      ;(Array.isArray(value) ? value : [value]).forEach((value) => {
        if (!set.has(value)) {
          set.add(value)
        }
      })

      return value
    }

    const clear = () => {
      set.clear()
    }

    const dispose = (cassiopeiaUpdate = true) => {
      clear()

      if (cassiopeiaUpdate && sets.delete(set)) {
        void update(__PLATFORM__ === 'browser')
      }
    }

    const del = (value: string | string[]) => {
      ;(Array.isArray(value) ? value : [value]).forEach((value) => {
        set.delete(value)
      })
    }

    return { add, clear, delete: del, dispose }
  }

  const dispose = () => {
    scope.stop()
    sets.clear()

    if (__PLATFORM__ === 'browser') {
      globalThis.__CASSIOPEIA_VUE__ = undefined
    }
    cassiopeia[STORE].subscriptions.clear()
    cassiopeia[STORE].iterators.clear()
    cassiopeia[STORE].cache.clear()
  }

  const cassiopeiaVue: Cassiopeia = {
    ...cassiopeia,
    createScope,
    dispose,
    update,
  }

  if (__PLATFORM__ === 'browser') {
    globalThis.__CASSIOPEIA_VUE__ = cassiopeiaVue
  }

  return cassiopeiaVue
}

export const createCassiopeia = (options: Options): CassiopeiaPlugin => {
  const value = createCassiopeiaVue(options)

  return {
    ...value,
    install: (app: App) => {
      app.provide(CASSIOPEIA_VUE_SYMBOL, value)
      app.onUnmount(value.dispose)
    },
  }
}
