import { assert, describe, expect, it } from 'vitest'
import { CASSIOPEIA_CANCEL, CASSIOPEIA_CONTEXT } from './constants'
import { createMultiplexer } from './create-multiplexer'
import { isReducerActive } from './create-terminating-reducers'
import {
  CASSIOPEIA_PLUGIN,
  createCassiopeia,
  renderStyleSheets,
  type CassiopeiaPlugin,
  type CassiopeiaReducer,
} from './index'
import { createCountingGenerator } from './test-support/create-counting-generator'
import { createDeferController } from './test-support/create-defer-controller'

interface ReducerState {
  collected: string[]
  variant: string
  wasCancelled: boolean
  wasCompleted: boolean
}

function* createTestReducer(config: {
  history: ReducerState[]
  variant: string
}): CassiopeiaReducer {
  const state: ReducerState = {
    collected: [],
    variant: config.variant,
    wasCancelled: false,
    wasCompleted: false,
  }

  const { history } = config

  history.push(state)

  let token

  while (isReducerActive((token = yield))) {
    state.collected.push(token)
  }

  if (token === CASSIOPEIA_CANCEL) {
    state.wasCancelled = true
    return undefined
  }

  state.wasCompleted = true

  return {
    content: `.${config.variant} { ${state.collected.map((marker, index) => `${marker}: ${index};`).join(' ')} }`,
  }
}

describe('createMultiplexer', () => {
  it('broadcasts input to multiple reducer instances and combines outputs in order', () => {
    const history: ReducerState[] = []

    const instance = createCassiopeia()

    const plugin: CassiopeiaPlugin = {
      [CASSIOPEIA_PLUGIN]: (context) => {
        context.reducerFactories.theme = createMultiplexer(createTestReducer, [
          { history, variant: 'light' },
          { history, variant: 'dark' },
        ])
      },
    }

    const generator = createCountingGenerator('var(---theme-a)', 'var(---theme-b)')
    instance.updateSync(generator.generator)

    instance.use(plugin)

    const styleSheets = renderStyleSheets(instance)

    assert.isDefined(styleSheets)
    assert.equal(styleSheets.length, 2)

    const [lightOutput, darkOutput] = styleSheets

    assert.equal(lightOutput.key, 'theme')
    assert.equal(lightOutput.index, 0)
    assert.equal(lightOutput.content, '.light { ---theme-a: 0; ---theme-b: 1; }')

    assert.equal(darkOutput.key, 'theme')
    assert.equal(darkOutput.index, 1)
    assert.equal(darkOutput.content, '.dark { ---theme-a: 0; ---theme-b: 1; }')

    assert.equal(history.length, 2)
    assert.equal(history[0].wasCompleted, true)
    assert.equal(history[0].wasCancelled, false)
    assert.equal(history[1].wasCompleted, true)
    assert.equal(history[1].wasCancelled, false)
  })

  it.runIf(__PLATFORM__ === 'browser')('cancels all child reducers when multiplexer is cancelled', async () => {
    const history: ReducerState[] = []
    const instance = createCassiopeia()
    const context = instance[CASSIOPEIA_CONTEXT]

    context.deferEvery = 1
    const deferController = createDeferController()
    context.defer = deferController.defer
    context.deferCancel = deferController.deferCancel

    const plugin: CassiopeiaPlugin = {
      [CASSIOPEIA_PLUGIN]: (context) => {
        context.reducerFactories.theme = createMultiplexer(createTestReducer, [
          { history, variant: 'light' },
          { history, variant: 'dark' },
        ])
      },
    }

    const generator1 = createCountingGenerator('var(---theme-a)', 'var(---theme-b)')
    const updatePromise1 = instance.update(generator1.generator)
    instance.use(plugin)

    assert.isTrue(deferController.hasQueued())

    deferController.executeNext()
    deferController.executeNext()

    const generator2 = createCountingGenerator('var(---theme-x)')
    const updatePromise2 = instance.update(generator2.generator)

    await deferController.setManual(false)

    await updatePromise1
    await updatePromise2

    expect(history).toMatchInlineSnapshot(`
      [
        {
          "collected": [
            "---theme-a",
          ],
          "variant": "light",
          "wasCancelled": true,
          "wasCompleted": false,
        },
        {
          "collected": [
            "---theme-a",
          ],
          "variant": "dark",
          "wasCancelled": true,
          "wasCompleted": false,
        },
        {
          "collected": [
            "---theme-x",
          ],
          "variant": "light",
          "wasCancelled": false,
          "wasCompleted": true,
        },
        {
          "collected": [
            "---theme-x",
          ],
          "variant": "dark",
          "wasCancelled": false,
          "wasCompleted": true,
        },
      ]
    `)
  })
})
