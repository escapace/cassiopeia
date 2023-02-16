import {
  createCassiopeia as cas,
  CassiopeiaInstance,
  STORE,
  TypeState,
  type Cassiopeia,
  type Variables
} from 'cassiopeia'
import { type App, type Plugin } from 'vue'
import { INJECTION_KEY_CASSIOPEIA, REGEX } from './constants'
import { Options } from './types'

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

export const createCassiopeia = (
  options: Options
): Plugin & CassiopeiaInstance & { subscribe: Cassiopeia['subscribe'] } => {
  const sets: Set<Set<string>> = new Set()

  const createVariables = () => createVariableIterator(sets)

  const instance = cas({ ...options, source: undefined })

  const update = (isAsync?: boolean) => {
    if (instance[STORE].state === TypeState.Active) {
      instance.update(createVariables, isAsync)
    }
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

  const subscribe = instance.subscribe

  return {
    [STORE]: instance[STORE],
    subscribe,
    install: (app: App) => {
      instance.start()

      app.provide(INJECTION_KEY_CASSIOPEIA, {
        createScope,
        update,
        subscribe
      })
    }
  }
}

export type { Options }
