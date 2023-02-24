import { createCassiopeia as cas, STORE, type Variables } from 'cassiopeia'
import { type App } from 'vue'
import { CASSIOPEIA_VUE_SYMBOL, REGEX } from './constants'
import { Cassiopeia, CassiopeiaPlugin, Options } from './types'

function* createVariableIterator(sets: Set<Set<string>>): Variables {
  for (const set of sets) {
    for (const string of set) {
      const match = string.match(REGEX)

      if (match?.length === 3) {
        const cancelled = yield match.slice(0, 3) as [string, string, string]

        if (cancelled) {
          return
        }
      }
    }
  }
}

const createCassiopeiaScope = (options: Options): Cassiopeia => {
  if (__BROWSER__) {
    if (typeof window.__CASSIOPEIA_VUE__ !== 'undefined') {
      return window.__CASSIOPEIA_VUE__
    }
  }

  const sets: Set<Set<string>> = new Set()

  const createVariables = () => createVariableIterator(sets)

  const cassiopeia = cas({ ...options })

  const update = async (isAsync?: boolean) => {
    return await cassiopeia.update(createVariables, isAsync)
  }

  const createScope = () => {
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

    const dispose = () => {
      clear()
      sets.delete(set)
    }

    const del = (value: string | string[]) => {
      ;(Array.isArray(value) ? value : [value]).forEach((value) => {
        set.delete(value)
      })
    }

    return { add, clear, delete: del, dispose }
  }

  const subscribe = cassiopeia.subscribe

  const cassiopeiaScope: Cassiopeia = {
    [STORE]: cassiopeia[STORE],
    createScope,
    update,
    subscribe
  }

  if (__BROWSER__) {
    window.__CASSIOPEIA_VUE__ = cassiopeiaScope
  }

  return cassiopeiaScope
}

export const createCassiopeia = (options: Options): CassiopeiaPlugin => {
  const scope = createCassiopeiaScope(options)

  return {
    [STORE]: scope[STORE],
    update: scope.update,
    subscribe: scope.subscribe,
    install: (app: App) => {
      app.provide(CASSIOPEIA_VUE_SYMBOL, scope)
    }
  }
}
