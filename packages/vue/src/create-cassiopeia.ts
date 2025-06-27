/* eslint-disable typescript/no-non-null-assertion */
import {
  createCassiopeia as createCassiopeiaInstance,
  CASSIOPEIA_STORE,
  type Plugin,
  type Variables,
} from 'cassiopeia'
import { computed, effectScope, toValue, watch, type App } from 'vue'
import { CASSIOPEIA_INJECTION_KEY, REGEX } from './constants'
import type { Cassiopeia, CassiopeiaScope, Options } from './types'

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

export const createCassiopeia = (options: Options = {}): Cassiopeia => {
  if (__PLATFORM__ === 'browser') {
    if (globalThis.__CASSIOPEIA__ !== undefined) {
      return globalThis.__CASSIOPEIA__
    }
  }

  const scope = effectScope(true)

  const sets = new Set<Set<string>>()

  const createVariables = () => createVariableIterator(sets)

  const instance = createCassiopeiaInstance()

  scope.run(() => {
    const deferEvery = computed(() => toValue(options.deferEvery))

    watch(
      deferEvery,
      (deferEvery) => {
        if (Number.isInteger(deferEvery) && deferEvery! > 0) {
          instance[CASSIOPEIA_STORE].deferEvery = deferEvery!
        }
      },
      { immediate: true },
    )
  })

  const update = async (isAsync?: boolean) => await instance.update(createVariables, isAsync)

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
      globalThis.__CASSIOPEIA__ = undefined
    }
    instance[CASSIOPEIA_STORE].subscriptions.splice(0)

    for (const property of Object.keys(instance[CASSIOPEIA_STORE].iterators)) {
      Reflect.deleteProperty(instance[CASSIOPEIA_STORE].iterators, property)
    }

    instance[CASSIOPEIA_STORE].cache.clear()
  }

  const cassiopeia: Cassiopeia = {
    ...instance,
    createScope,
    dispose,
    install: (app: App) => {
      app.provide(CASSIOPEIA_INJECTION_KEY, cassiopeia)
      app.onUnmount(cassiopeia.dispose)
    },
    update,
    use: (...plugins: Plugin[]) => {
      instance.use(...plugins)

      return cassiopeia
    },
  }

  if (__PLATFORM__ === 'browser') {
    globalThis.__CASSIOPEIA__ = cassiopeia
  }

  return cassiopeia
}
