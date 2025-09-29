import { beforeAll, bench, describe } from 'vitest'
import {
  CASSIOPEIA_PLUGIN,
  createCassiopeia,
  isTerminatingReducerNotTerminated,
  TERMINATING_REDUCER_CANCEL,
  type CassiopeiaGenerator,
  type CassiopeiaPlugin,
  type CassiopeiaPluginContext,
  type CassiopeiaReducer,
  type CassiopeiaStyleSheet,
  type TerminatingReducerCancel,
  type TerminatingReducerNext,
} from './index'

// eslint-disable-next-line typescript/require-await
async function createSimpleCountingStylesheet(
  NUMBER_PROPERTIES: Array<[string, string]>,
): Promise<CassiopeiaStyleSheet[]> {
  function* simpleGenerator() {
    for (const property of NUMBER_PROPERTIES) {
      yield property
    }
  }

  const generator = simpleGenerator()
  let stylesheet = ':root { '
  let localIndex = -1

  while (true) {
    const result = generator.next()
    if (result.done === true) {
      break
    }
    const [key, suffix] = result.value
    stylesheet += `---${key}-${suffix}: ${++localIndex}; `
  }

  stylesheet += '}'
  // return stylesheet

  return [
    {
      content: stylesheet,
      index: 0,
      key: 'number',
    },
  ]
}

function createCountingGenerator(properties: Array<[string, string]>) {
  function* countingGenerator(): CassiopeiaGenerator {
    let token: TerminatingReducerCancel | undefined

    for (const pair of properties) {
      token = yield pair

      if (token === TERMINATING_REDUCER_CANCEL) {
        return
      }
    }

    return
  }

  return countingGenerator
}

function createNumberPlugin(): CassiopeiaPlugin {
  return {
    [CASSIOPEIA_PLUGIN]: (context: CassiopeiaPluginContext) => {
      context.reducerFactories.number = function* numberReducer(): CassiopeiaReducer {
        const markers: string[] = []
        let localIndex = -1
        let token: TerminatingReducerNext<string>

        while (isTerminatingReducerNotTerminated((token = yield))) {
          markers.push(token)
        }

        if (token === TERMINATING_REDUCER_CANCEL) {
          return undefined
        }

        if (markers.length === 0) {
          return undefined
        }

        return {
          content: `:root { ${markers.map((marker) => `${marker}: ${++localIndex};`).join(' ')} }`,
        }
      }
    },
  }
}

function createNumberProperties(COUNT: number): Array<[string, string]> {
  const properties: Array<[string, string]> = []
  let count = 0

  while (count <= COUNT) {
    properties.push(['number', count.toString()])
    count++
  }

  return properties
}

// eslint-disable-next-line typescript/no-empty-function
const noop = (_: unknown) => {}
const instance = createCassiopeia()
const plugin = createNumberPlugin()
instance.use(plugin)
instance.subscribe((value) => {
  noop(value)
})

for (const count of [100, 1000, 10_000, 100_000]) {
  // warmup
  beforeAll(async () => {
    await createSimpleCountingStylesheet(createNumberProperties(10))
    await instance.updateSync(createCountingGenerator(createNumberProperties(10)))
  })

  const NUMBER_PROPERTIES = createNumberProperties(count)

  describe(`CSS Generation Performance (${count} items)`, () => {
    bench('simple counting generator with while loop', async () => {
      await createSimpleCountingStylesheet(NUMBER_PROPERTIES)
    })

    bench('cassiopeia generator with plugin', async () => {
      await instance.updateSync(createCountingGenerator(NUMBER_PROPERTIES))
    })
  })
}
