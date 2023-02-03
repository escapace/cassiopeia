import { REGEX, SOURCE } from '../constants'
import { Source, Store, TypeState, Variables } from '../types'

function* createVariableIterator(strings: string[]): Variables {
  for (const string of strings) {
    for (const match of string.matchAll(REGEX)) {
      const cancelled = yield match as [string, string, string]

      if (cancelled) {
        return
      }
    }
  }
}

export const createSourceStrings =
  (strings: string[]): Source =>
  (store: Store, update: (createVariables: () => Variables) => void) => {
    const createVariables = () => createVariableIterator(strings)

    const start = () => {
      if (store.state !== TypeState.Activating) return

      update(createVariables)
    }

    return {
      [SOURCE]: {
        start
      }
    }
  }
