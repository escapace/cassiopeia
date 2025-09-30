import {
  CASSIOPEIA_REGEX,
  CASSIOPEIA_CANCEL,
  type CassiopeiaGenerator,
  type CassiopeiaCancel,
} from '../index'

interface CountingGeneratorState {
  pullCount: number
  wasCancelled: boolean
  wasCompleted: boolean
}

export function createCountingGenerator(...strings: string[]) {
  const history: CountingGeneratorState[] = []

  function* countingGenerator(): CassiopeiaGenerator {
    const state: CountingGeneratorState = {
      pullCount: 0,
      wasCancelled: false,
      wasCompleted: false,
    }
    history.push(state)

    let token: CassiopeiaCancel | undefined

    for (const string of strings) {
      state.pullCount++

      for (const match of string.matchAll(CASSIOPEIA_REGEX)) {
        const pair = match.splice(1) as unknown as [string, string]
        token = yield pair

        if (token === CASSIOPEIA_CANCEL) {
          state.wasCancelled = true
          return
        }
      }
    }

    state.wasCompleted = true
    return
  }

  return {
    generator: countingGenerator,
    history,
    get state() {
      return history.at(-1)
    },
  }
}

export function createManyPropertiesGenerator(count: number, keyPrefix: string) {
  const properties = Array(count)
    .fill(0)
    .map((_, index) => `var(---${keyPrefix}-prop${index})`)
  // .join(' ')
  return createCountingGenerator(...properties)
}
