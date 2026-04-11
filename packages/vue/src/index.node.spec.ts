import { afterEach, describe, expect, it } from 'vitest'
import { renderStyleSheets } from 'cassiopeia'
import { createSSRApp, defineComponent, h, inject } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { CASSIOPEIA_INJECTION_KEY, createCassiopeia } from './index'
import { createPublicPlugin } from './test-support/create-public-plugin'

const renderServerReady = () => h('main', 'server ready')
const renderManualProvideWorks = () => h('section', 'manual provide works')

afterEach(async () => {
  await globalThis.__CASSIOPEIA__?.dispose?.()
  globalThis.__CASSIOPEIA__ = undefined
})

describe('node end-user flows', () => {
  it('renders an SSR app and makes the installed instance injectable to components', async () => {
    const cassiopeia = createCassiopeia()
    cassiopeia.use(createPublicPlugin('theme').plugin)

    const scope = cassiopeia.createScope()
    scope.add('---theme-primary')
    scope.add('---theme-secondary')
    scope.updateSync()

    let injectedInstance: unknown

    const Root = defineComponent({
      name: 'Root',
      setup() {
        injectedInstance = inject(CASSIOPEIA_INJECTION_KEY)
        return renderServerReady
      },
    })

    const app = createSSRApp(Root)
    app.use(cassiopeia)

    const html = await renderToString(app)

    expect(html).toContain('server ready')
    expect(injectedInstance).toBe(cassiopeia)
    expect(renderStyleSheets(cassiopeia)).toEqual([
      {
        content: ':root { --theme-primary: 1; --theme-secondary: 2; }',
        index: 0,
        key: 'theme',
      },
    ])
  })

  it('supports manually providing the exported injection key', async () => {
    const cassiopeia = createCassiopeia()
    cassiopeia.use(createPublicPlugin('theme').plugin)

    const scope = cassiopeia.createScope()
    scope.add('---theme-manual')
    scope.updateSync()

    let injectedInstance: unknown

    const Root = defineComponent({
      name: 'Root',
      setup() {
        injectedInstance = inject(CASSIOPEIA_INJECTION_KEY)
        return renderManualProvideWorks
      },
    })

    const app = createSSRApp(Root)
    app.provide(CASSIOPEIA_INJECTION_KEY, cassiopeia)

    const html = await renderToString(app)

    expect(html).toContain('manual provide works')
    expect(injectedInstance).toBe(cassiopeia)
    expect(renderStyleSheets(cassiopeia)).toEqual([
      {
        content: ':root { --theme-manual: 1; }',
        index: 0,
        key: 'theme',
      },
    ])
  })

  it('creates isolated instances in node instead of reusing a browser singleton', async () => {
    const first = createCassiopeia()
    const second = createCassiopeia()

    expect(second).not.toBe(first)
    expect(globalThis.__CASSIOPEIA__).toBeUndefined()

    await first.dispose()
    await second.dispose()
  })
})
