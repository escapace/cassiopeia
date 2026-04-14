import { afterEach, describe, expect, it, vi } from 'vitest'
import { CASSIOPEIA_CONTEXT, renderStyleSheets } from 'cassiopeia'
import { createApp, defineComponent, h, nextTick, ref, type Component, type Ref } from 'vue'
import { createCassiopeia, updateStyle, useCassiopeia } from './index'
import { createPublicPlugin } from './test-support/create-public-plugin'

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const renderChildReady = () => h('p', 'child ready')
const renderChildRemoved = () => h('p', 'child removed')
const renderUnreachable = () => h('p', 'unreachable')

const createToggleRenderer = (showChild: Ref<boolean>, Child: Component) => () =>
  showChild.value ? h(Child) : renderChildRemoved()

const createToggleRoot = (showChild: Ref<boolean>, Child: Component) =>
  defineComponent({
    name: 'Root',
    setup: () => createToggleRenderer(showChild, Child),
  })

afterEach(async () => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  await globalThis.__CASSIOPEIA__?.dispose()
  globalThis.__CASSIOPEIA__ = undefined
})

describe('browser end-user flows', () => {
  it('installs into a Vue app and disposes component scopes when components unmount', async () => {
    const cassiopeia = createCassiopeia()
    const themePlugin = createPublicPlugin('theme')
    cassiopeia.use(themePlugin.plugin)

    const showChild = ref(true)

    const Child = defineComponent({
      name: 'Child',
      setup() {
        const scope = useCassiopeia()
        scope.add('---theme-primary')
        scope.updateSync()

        return renderChildReady
      },
    })

    const Root = createToggleRoot(showChild, Child)

    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp(Root)
    app.use(cassiopeia)
    app.mount(container)

    expect(container.textContent).toContain('child ready')
    expect(globalThis.__CASSIOPEIA__).toBe(cassiopeia)
    expect(renderStyleSheets(cassiopeia)).toEqual([
      {
        content: ':root { --theme-primary: 1; }',
        index: 0,
        key: 'theme',
      },
    ])

    showChild.value = false
    await nextTick()

    cassiopeia.updateSync()

    expect(container.textContent).toContain('child removed')
    expect(renderStyleSheets(cassiopeia)).toEqual([])

    app.unmount()

    expect(globalThis.__CASSIOPEIA__).toBeUndefined()
  })

  it('reuses a singleton in the browser until that instance is disposed', async () => {
    const first = createCassiopeia()
    const second = createCassiopeia()

    expect(second).toBe(first)

    await first.dispose()

    const third = createCassiopeia()

    expect(third).not.toBe(first)

    await third.dispose()
  })

  it('throws a helpful error when the composable is used without installing the plugin', () => {
    const Root = defineComponent({
      name: 'Root',
      setup() {
        useCassiopeia()
        return renderUnreachable
      },
    })

    const container = document.createElement('div')
    const app = createApp(Root)

    expect(() => app.mount(container)).toThrow('Is vue cassiopeia plugin added?')
  })

  it('applies custom scheduler options and reacts to deferEvery changes', async () => {
    const deferEvery = ref<number | undefined>(undefined)
    const defer = vi.fn<(callback: () => void) => number>((callback) =>
      window.setTimeout(callback, 0),
    )
    const deferCancel = vi.fn<(id: number) => void>((id) => window.clearTimeout(id))

    const cassiopeia = createCassiopeia({ defer, deferCancel, deferEvery })

    expect(cassiopeia[CASSIOPEIA_CONTEXT].defer).toBe(defer)
    expect(cassiopeia[CASSIOPEIA_CONTEXT].deferCancel).toBe(deferCancel)

    deferEvery.value = 5
    await nextTick()
    expect(cassiopeia[CASSIOPEIA_CONTEXT].deferEvery).toBe(5)

    deferEvery.value = 0
    await nextTick()
    expect(cassiopeia[CASSIOPEIA_CONTEXT].deferEvery).toBe(5)
  })

  it('waits for the browser singleton in updateStyle, then registers cleanup and updates styles', async () => {
    vi.useFakeTimers()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cleanupCallbacks: Array<() => void> = []

    updateStyle(
      'entry.css',
      '.button { color: var(---theme-primary); border-color: var(---theme-secondary, red); }',
      (callback) => cleanupCallbacks.push(callback),
    )

    vi.advanceTimersByTime(200)

    const cassiopeia = createCassiopeia({
      defer: (callback) => {
        callback()
        return 0
      },
      deferCancel: () => undefined,
    })
    cassiopeia.use(createPublicPlugin('theme').plugin)

    vi.advanceTimersByTime(100)
    await flushMicrotasks()
    cassiopeia.updateSync()

    expect(cleanupCallbacks).toHaveLength(1)
    expect(renderStyleSheets(cassiopeia)).toEqual([
      {
        content: ':root { --theme-primary: 1; --theme-secondary: 2; }',
        index: 0,
        key: 'theme',
      },
    ])

    cleanupCallbacks[0]()
    cassiopeia.updateSync()

    expect(warn).toHaveBeenCalledWith("[cassiopeia] disposing scope 'entry.css'")
    expect(renderStyleSheets(cassiopeia)).toEqual([])
  })

  it('warns when updateStyle cannot find a browser instance in time', () => {
    vi.useFakeTimers()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    updateStyle('missing.css', '.button { color: var(---theme-primary); }', () => undefined)

    vi.advanceTimersByTime(3100)

    expect(warn).toHaveBeenCalledWith("[cassiopeia] update failed for 'missing.css'")
  })
})
