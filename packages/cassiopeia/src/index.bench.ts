import { remove } from 'coastal'
import { bench, describe } from 'vitest'
import {
  CASSIOPEIA_PLUGIN,
  createCassiopeia,
  isReducerActive,
  CASSIOPEIA_CANCEL,
  type Cassiopeia,
  type CassiopeiaGenerator,
  type CassiopeiaPlugin,
  type CassiopeiaPluginContext,
  type CassiopeiaReducer,
  type CassiopeiaStyleSheets,
  type CassiopeiaSubscription,
  type CassiopeiaCancel,
  type TerminatingReducerNext,
} from './index'

const simpleCountingStylesheetOrchastrator = (
  createGenerator: () => CassiopeiaGenerator,
): CassiopeiaStyleSheets => {
  const generator = createGenerator()
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

  return [
    {
      content: stylesheet,
      index: 0,
      key: 'number',
    },
  ]
}

function createSimpleCountingStylesheet() {
  const subscriptions: CassiopeiaSubscription[] = []

  const updateSync = (generator: () => CassiopeiaGenerator) => {
    const value = simpleCountingStylesheetOrchastrator(generator)

    for (const subscription of subscriptions) {
      subscription(new Set(value.map((v) => v.key)), value)
    }
  }

  return {
    updateSync,
    subscribe: (subscription: CassiopeiaSubscription) => {
      if (!subscriptions.includes(subscription)) {
        subscriptions.push(subscription)
      }

      return () => {
        remove(subscriptions, (value) => value === subscription)
      }
    },
  }
}

function createCountingGenerator(properties: Array<[string, string]>) {
  function* countingGenerator(): CassiopeiaGenerator {
    let token: CassiopeiaCancel | undefined

    for (const pair of properties) {
      token = yield pair

      if (token === CASSIOPEIA_CANCEL) {
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

        while (isReducerActive((token = yield))) {
          markers.push(token)
        }

        if (token === CASSIOPEIA_CANCEL) {
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

for (const count of [100, 1000, 10_000, 50_000]) {
  const NUMBER_PROPERTIES = createNumberProperties(count)
  let cassiopeia: Cassiopeia
  let simple: ReturnType<typeof createSimpleCountingStylesheet>

  describe(`CSS Generation Performance (${count} items)`, () => {
    bench(
      'simple counting generator with while loop',
      async () => {
        let resolve: (value: CassiopeiaStyleSheets) => void
        const promise = new Promise<CassiopeiaStyleSheets>((value) => {
          resolve = value
        })
        const unsubscribe = simple.subscribe((_keys, values) => {
          resolve(values)
        })
        simple.updateSync(createCountingGenerator(NUMBER_PROPERTIES))

        await promise.finally(() => unsubscribe())
        return
      },
      {
        iterations: 100,
        warmupIterations: 10,
        setup: () => {
          simple = createSimpleCountingStylesheet()
        },
      },
    )

    bench(
      'cassiopeia generator with plugin',
      async () => {
        let resolve: (value: CassiopeiaStyleSheets) => void
        const promise = new Promise<CassiopeiaStyleSheets>((value) => {
          resolve = value
        })
        const unsubscribe = cassiopeia.subscribe((_keys, values) => {
          resolve(values)
        })

        cassiopeia.updateSync(createCountingGenerator(NUMBER_PROPERTIES))

        await promise.finally(() => unsubscribe())
        return
      },
      {
        iterations: 100,
        warmupIterations: 10,
        setup: () => {
          cassiopeia = createCassiopeia()
          const plugin = createNumberPlugin()
          cassiopeia.use(plugin)
        },
      },
    )
  })
}
