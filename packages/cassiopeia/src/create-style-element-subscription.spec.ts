import { afterEach, assert, describe, expect, it } from 'vitest'
import { createCassiopeia, createStyleElementSubscription } from './index'
import { createCountingGenerator } from './test-support/create-counting-generator'
import { createTestContainer, createTestSelector } from './test-support/create-test-container'
import { createTracePlugin } from './test-support/create-trace-plugin'
import {
  assertStyleElementCount,
  assertStyleElementExists,
  assertStyleElementHasMedia,
  assertStyleElementHasNoMedia,
  assertStyleElementNotExists,
  getStyleElements,
} from './test-support/dom-assertions'

const IS_BROWSER = __PLATFORM__ === 'browser'

describe.runIf(IS_BROWSER)('createStyleElementSubscription', () => {
  afterEach(() => {
    // Clean up any style elements that might have been added to document.head
    document.head.querySelectorAll('style[cassiopeia-key]').forEach((element) => element.remove())
  })

  describe('basic DOM integration', () => {
    it('creates style elements in document.head by default', () => {
      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription()
      instance.subscribe(subscription)

      const plugin = createTracePlugin('test')
      instance.use(plugin.plugin)

      const generator = createCountingGenerator('var(---test-prop1)', 'var(---test-prop2)')
      instance.updateSync(generator.generator)

      assertStyleElementCount(document.head, 1)
      assertStyleElementExists(
        document.head,
        'test',
        0,
        ':root { ---test-prop1: 1; ---test-prop2: 2; }',
      )
    })

    it('updates existing style elements with overwrite method', () => {
      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription({ method: 'overwrite' })
      instance.subscribe(subscription)

      const plugin = createTracePlugin('test')
      instance.use(plugin.plugin)

      // First update
      const generator1 = createCountingGenerator('var(---test-initial)')
      instance.updateSync(generator1.generator)

      assertStyleElementCount(document.head, 1)
      const elements1 = getStyleElements(document.head)
      const firstElement = elements1[0].element

      // Second update
      const generator2 = createCountingGenerator('var(---test-updated)')
      instance.updateSync(generator2.generator)

      assertStyleElementCount(document.head, 1)
      const elements2 = getStyleElements(document.head)

      // Should be the same element reference (overwrite)
      assert.equal(elements2[0].element, firstElement)
      assertStyleElementExists(document.head, 'test', 0, ':root { ---test-updated: 1; }')
    })

    it('replaces style elements with insert-discard method', () => {
      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription({ method: 'insert-discard' })
      instance.subscribe(subscription)

      const plugin = createTracePlugin('test')
      instance.use(plugin.plugin)

      // First update
      const generator1 = createCountingGenerator('var(---test-initial)')
      instance.updateSync(generator1.generator)

      assertStyleElementCount(document.head, 1)
      const elements1 = getStyleElements(document.head)
      const firstElement = elements1[0].element

      // Second update
      const generator2 = createCountingGenerator('var(---test-updated)')
      instance.updateSync(generator2.generator)

      assertStyleElementCount(document.head, 1)
      const elements2 = getStyleElements(document.head)

      // Should be a different element reference (insert-discard)
      assert.notEqual(elements2[0].element, firstElement)
      assertStyleElementExists(document.head, 'test', 0, ':root { ---test-updated: 1; }')
    })

    it('removes style elements when keys are no longer present', async () => {
      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription()
      instance.subscribe(subscription)

      const pluginA = createTracePlugin('a')
      const pluginB = createTracePlugin('b')
      instance.use(pluginA.plugin, pluginB.plugin)

      // Create both elements
      const generator1 = createCountingGenerator('var(---a-test)', 'var(---b-test)')
      instance.updateSync(generator1.generator)

      assertStyleElementCount(document.head, 2)
      assertStyleElementExists(document.head, 'a', 0, ':root { ---a-test: 1; }')
      assertStyleElementExists(document.head, 'b', 0, ':root { ---b-test: 1; }')

      // Remove plugin B - this should remove its reducer factory
      await pluginB.dispose()

      assertStyleElementCount(document.head, 1)
      assertStyleElementExists(document.head, 'a', 0, ':root { ---a-test: 1; }')
      assertStyleElementNotExists(document.head, 'b', 0)
    })
  })

  describe('container targeting', () => {
    it('creates style elements in custom element container', () => {
      const testContainer = createTestContainer('div')

      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription({ container: testContainer.element })
      instance.subscribe(subscription)

      const plugin = createTracePlugin('test')
      instance.use(plugin.plugin)

      const generator = createCountingGenerator('var(---test-prop)')
      instance.updateSync(generator.generator)

      assertStyleElementCount(testContainer.element, 1)
      assertStyleElementExists(testContainer.element, 'test', 0, ':root { ---test-prop: 1; }')

      // Should not create elements in document.head
      assertStyleElementCount(document.head, 0)

      testContainer.cleanup()
    })

    it('creates style elements in shadow root container', () => {
      const testContainer = createTestContainer('shadow')

      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription({ container: testContainer.element })
      instance.subscribe(subscription)

      const plugin = createTracePlugin('test')
      instance.use(plugin.plugin)

      const generator = createCountingGenerator('var(---test-shadow)')
      instance.updateSync(generator.generator)

      assertStyleElementCount(testContainer.element, 1)
      assertStyleElementExists(testContainer.element, 'test', 0, ':root { ---test-shadow: 1; }')

      // Should not create elements in document.head
      assertStyleElementCount(document.head, 0)

      testContainer.cleanup()
    })

    it('creates style elements using CSS selector', () => {
      const testSelector = createTestSelector()

      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription({ container: testSelector.selector })
      instance.subscribe(subscription)

      const plugin = createTracePlugin('test')
      instance.use(plugin.plugin)

      const generator = createCountingGenerator('var(---test-selector)')
      instance.updateSync(generator.generator)

      assertStyleElementCount(testSelector.element, 1)
      assertStyleElementExists(testSelector.element, 'test', 0, ':root { ---test-selector: 1; }')

      // Should not create elements in document.head
      assertStyleElementCount(document.head, 0)

      testSelector.cleanup()
    })

    it('throws error for invalid CSS selector', () => {
      assert.throws(
        () => createStyleElementSubscription({ container: '#nonexistent-element' }),
        /Failed to resolve container selector/,
      )
    })
  })

  describe('namespace support', () => {
    it('creates qualified attributes with namespace', () => {
      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription({ namespace: 'theme' })
      instance.subscribe(subscription)

      const plugin = createTracePlugin('test')
      instance.use(plugin.plugin)

      const generator = createCountingGenerator('var(---test-prop)')
      instance.updateSync(generator.generator)

      const elements = getStyleElements(document.head, 'theme')
      assert.equal(elements.length, 1)
      assert.equal(elements[0].key, 'test')
      assert.equal(elements[0].index, 0)

      // Verify the actual attributes
      const element = elements[0].element
      assert.equal(element.getAttribute('cassiopeia-key-theme'), 'test')
      assert.equal(element.getAttribute('cassiopeia-index-theme'), '0')
    })

    it('isolates namespaced style elements', () => {
      const instance1 = createCassiopeia()
      const instance2 = createCassiopeia()

      const subscription1 = createStyleElementSubscription({ namespace: 'app' })
      const subscription2 = createStyleElementSubscription({ namespace: 'theme' })
      instance1.subscribe(subscription1)
      instance2.subscribe(subscription2)

      const plugin1 = createTracePlugin('component')
      const plugin2 = createTracePlugin('component')
      instance1.use(plugin1.plugin)
      instance2.use(plugin2.plugin)

      const generator1 = createCountingGenerator('var(---component-app)')
      const generator2 = createCountingGenerator('var(---component-theme)')
      instance1.updateSync(generator1.generator)
      instance2.updateSync(generator2.generator)

      // Total elements should be 2
      const allElements = document.head.querySelectorAll(
        'style[cassiopeia-key-app], style[cassiopeia-key-theme]',
      )
      assert.equal(allElements.length, 2)

      const appElements = getStyleElements(document.head, 'app')
      const themeElements = getStyleElements(document.head, 'theme')

      assert.equal(appElements.length, 1)
      assert.equal(themeElements.length, 1)
      assert.equal(appElements[0].content, ':root { ---component-app: 1; }')
      assert.equal(themeElements[0].content, ':root { ---component-theme: 1; }')
    })
  })

  describe('media attribute handling', () => {
    it('sets media attribute when provided', () => {
      const subscription = createStyleElementSubscription()

      // Directly test the subscription with mock data that includes media
      subscription(new Set(['test']), [
        {
          content: ':root { --test: 1; }',
          index: 0,
          key: 'test',
          media: 'screen and (min-width: 768px)',
        },
      ])

      assertStyleElementHasMedia(document.head, 'test', 0, 'screen and (min-width: 768px)')
    })

    it('updates media attribute on existing elements with overwrite method', () => {
      const subscription = createStyleElementSubscription({ method: 'overwrite' })

      // First create element without media
      subscription(new Set(['test']), [
        {
          content: ':root { --test: 1; }',
          index: 0,
          key: 'test',
        },
      ])

      assertStyleElementHasNoMedia(document.head, 'test', 0)

      // Update same element with media attribute
      subscription(new Set(['test']), [
        {
          content: ':root { --test: 2; }',
          index: 0,
          key: 'test',
          media: 'screen and (min-width: 768px)',
        },
      ])

      assertStyleElementHasMedia(document.head, 'test', 0, 'screen and (min-width: 768px)')
      assertStyleElementExists(document.head, 'test', 0, ':root { --test: 2; }')
    })

    it('removes media attribute when not provided in updates', () => {
      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription({ method: 'overwrite' })
      instance.subscribe(subscription)

      // First create element with media
      const element = document.createElement('style')
      element.setAttribute('cassiopeia-key', 'test')
      element.setAttribute('cassiopeia-index', '0')
      element.setAttribute('media', 'screen')
      element.innerHTML = 'initial content'
      document.head.appendChild(element)

      const plugin = createTracePlugin('test')
      instance.use(plugin.plugin)

      // Update without media should remove the attribute
      const generator = createCountingGenerator('var(---test-updated)')
      instance.updateSync(generator.generator)

      assertStyleElementHasNoMedia(document.head, 'test', 0)
    })
  })

  describe('multiple plugins and complex scenarios', () => {
    it('handles multiple plugins with different keys', () => {
      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription()
      instance.subscribe(subscription)

      // Create two separate plugins to simulate multiple stylesheets
      const pluginA = createTracePlugin('multi')
      const pluginB = createTracePlugin('second')
      instance.use(pluginA.plugin, pluginB.plugin)

      const generator = createCountingGenerator('var(---multi-prop)', 'var(---second-prop)')
      instance.updateSync(generator.generator)

      assertStyleElementCount(document.head, 2)
      assertStyleElementExists(document.head, 'multi', 0, ':root { ---multi-prop: 1; }')
      assertStyleElementExists(document.head, 'second', 0, ':root { ---second-prop: 1; }')
    })

    it('handles empty updates gracefully', () => {
      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription()
      instance.subscribe(subscription)

      const plugin = createTracePlugin('empty')
      instance.use(plugin.plugin)

      // Generator with no matching properties
      const generator = createCountingGenerator('some text without vars')
      instance.updateSync(generator.generator)

      // Should have no style elements
      assertStyleElementCount(document.head, 0)
    })

    it('maintains element order consistency', () => {
      const instance = createCassiopeia()

      const subscription = createStyleElementSubscription()
      instance.subscribe(subscription)

      const pluginC = createTracePlugin('c')
      const pluginA = createTracePlugin('a')
      const pluginB = createTracePlugin('b')
      instance.use(pluginB.plugin, pluginA.plugin, pluginC.plugin)

      for (let index = 0; index < 3; index++) {
        const generator = createCountingGenerator(
          'var(---c-test)',
          'var(---b-test)',
          'var(---a-test)',
        )
        instance.updateSync(generator.generator)

        const elements = getStyleElements(document.head)
        const keys = elements.map((element) => element.key)

        // Order should be consistent across runs
        expect(keys).toEqual(['b', 'a', 'c'])
      }
    })

    it('removes style elements with same key but different indices when only some indices are updated', () => {
      const subscription = createStyleElementSubscription()

      // First, create two style elements with same key but different indices
      subscription(new Set(['test']), [
        {
          content: ':root { --test-0: value0; }',
          index: 0,
          key: 'test',
        },
        {
          content: ':root { --test-1: value1; }',
          index: 1,
          key: 'test',
        },
      ])

      // Verify both elements exist
      assertStyleElementCount(document.head, 2)
      assertStyleElementExists(document.head, 'test', 0, ':root { --test-0: value0; }')
      assertStyleElementExists(document.head, 'test', 1, ':root { --test-1: value1; }')

      // Update with only index 0 - index 1 should be removed
      subscription(new Set(['test']), [
        {
          content: ':root { --test-0: updated; }',
          index: 0,
          key: 'test',
        },
      ])

      // Should only have one element now (index 0), index 1 should be deleted
      assertStyleElementCount(document.head, 1)
      assertStyleElementExists(document.head, 'test', 0, ':root { --test-0: updated; }')
      assertStyleElementNotExists(document.head, 'test', 1)
    })

    it('removes elements only when their key has values but their key+index combination is missing', () => {
      const subscription = createStyleElementSubscription()

      // Create elements: theme with indices 0,1 and components with index 0
      subscription(new Set(['components', 'theme']), [
        {
          content: ':root { --theme-primary: blue; }',
          index: 0,
          key: 'theme',
        },
        {
          content: ':root { --theme-secondary: green; }',
          index: 1,
          key: 'theme',
        },
        {
          content: '.button { color: red; }',
          index: 0,
          key: 'components',
        },
      ])

      // Verify all three elements exist
      assertStyleElementCount(document.head, 3)
      assertStyleElementExists(document.head, 'theme', 0, ':root { --theme-primary: blue; }')
      assertStyleElementExists(document.head, 'theme', 1, ':root { --theme-secondary: green; }')
      assertStyleElementExists(document.head, 'components', 0, '.button { color: red; }')

      // Update: both keys remain active, but theme only has index 0 now, components has no values
      // theme:1 should be removed (key active but key+index combo missing)
      // components:0 should remain (key active even though no values)
      // theme:0 should remain (key active and key+index combo present)
      subscription(new Set(['components', 'theme']), [
        {
          content: ':root { --theme-primary: updated; }',
          index: 0,
          key: 'theme',
        },
      ])

      // Should have theme index 0 and components index 0
      assertStyleElementCount(document.head, 2)
      assertStyleElementExists(document.head, 'theme', 0, ':root { --theme-primary: updated; }')
      assertStyleElementNotExists(document.head, 'theme', 1)
      assertStyleElementExists(document.head, 'components', 0, '.button { color: red; }')

      // Now remove all keys - remaining element should be deleted
      subscription(new Set([]), [])

      // Should have no elements now
      assertStyleElementCount(document.head, 0)
    })

    it('removes elements when keys are no longer active', () => {
      const subscription = createStyleElementSubscription()

      // Create elements for multiple keys
      subscription(new Set(['components', 'nonexistent', 'theme']), [
        {
          content: ':root { --theme-color: blue; }',
          index: 0,
          key: 'theme',
        },
        {
          content: '.button { color: red; }',
          index: 0,
          key: 'components',
        },
      ])

      // Verify both elements exist
      assertStyleElementCount(document.head, 2)
      assertStyleElementExists(document.head, 'theme', 0, ':root { --theme-color: blue; }')
      assertStyleElementExists(document.head, 'components', 0, '.button { color: red; }')

      // Update with only 'theme' key active - components should be removed
      subscription(new Set(['theme']), [
        {
          content: ':root { --theme-color: green; }',
          index: 0,
          key: 'theme',
        },
      ])

      // Should only have theme element now - components removed because key no longer active
      assertStyleElementCount(document.head, 1)
      assertStyleElementExists(document.head, 'theme', 0, ':root { --theme-color: green; }')
      assertStyleElementNotExists(document.head, 'components', 0)
    })
  })
})
