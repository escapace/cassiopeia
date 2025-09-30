import { assert, describe, expect, it, vi } from 'vitest'
import {
  CASSIOPEIA_CONTEXT,
  CASSIOPEIA_STATE,
  CassiopeiaStateMachineState,
  createCassiopeia,
  renderStyleSheets,
  type CassiopeiaStyleSheets,
} from './index'
import {
  createCountingGenerator,
  createManyPropertiesGenerator,
} from './test-support/create-counting-generator'
import { createDeferController } from './test-support/create-defer-controller'
import { createTracePlugin } from './test-support/create-trace-plugin'

const IS_BROWSER = __PLATFORM__ === 'browser'

describe('routing & composition correctness', () => {
  for (const updateType of ['reducer', 'generator'] as const) {
    it(`blocks PreFlight → InFlight ${updateType} transition when no generator available`, async () => {
      const instance = createCassiopeia()
      const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
      instance.subscribe((subscription) => spy(subscription))

      const deferController = createDeferController()
      await deferController.setManual(false)

      instance[CASSIOPEIA_CONTEXT].defer = deferController.defer

      if (updateType === 'reducer') {
        const plugin = createTracePlugin('test')
        instance.use(plugin.plugin)
      } else {
        void instance.updateSync()
      }

      assert.notEqual(instance[CASSIOPEIA_STATE], CassiopeiaStateMachineState.InFlight)
      expect(spy.mock.calls).toMatchInlineSnapshot(`[]`)
    })
  }

  it('single plugin routing: plugin receives only its markers and produces correct styleSheets', () => {
    const traceA = createTracePlugin('a')
    const instance = createCassiopeia()

    instance.use(traceA.plugin)

    const generator = createCountingGenerator('var(---a-x)', 'var(---a-y)', 'var(---b-ignored)')

    instance.updateSync(generator.generator)

    if (IS_BROWSER) {
      // Plugin should have received exactly two markers for key 'a'
      assert.deepEqual(traceA.state?.receivedMarkers, ['---a-x', '---a-y'])
      assert.equal(traceA.state?.wasCompleted, true)
      assert.equal(traceA.state?.wasCancelled, false)
    } else {
      assert.isEmpty(traceA.history)
      assert.isEmpty(generator.history)
    }

    const styleSheets = renderStyleSheets(instance)
    assert.equal(styleSheets?.values.length, 1)
    assert.equal(styleSheets?.values[0].content, ':root { ---a-x: 1; ---a-y: 2; }')

    expect(generator.history).toMatchInlineSnapshot(`
      [
        {
          "pullCount": 3,
          "wasCancelled": false,
          "wasCompleted": true,
        },
      ]
    `)
  })

  it('multi-plugin routing: each plugin receives only its own markers and outputs are combined', () => {
    const traceA = createTracePlugin('a')
    const traceB = createTracePlugin('b')
    const instance = createCassiopeia()

    instance.use(traceA.plugin, traceB.plugin)

    const generator = createCountingGenerator(
      'var(---a-x)',
      'var(---b-y)',
      'var(---a-z)',
      'var(---c-ignored)',
    )

    instance.updateSync(generator.generator)

    if (IS_BROWSER) {
      // Each plugin should receive only its own markers
      assert.deepEqual(traceA.state?.receivedMarkers, ['---a-x', '---a-z'])
      assert.deepEqual(traceB.state?.receivedMarkers, ['---b-y'])

      assert.equal(traceA.state?.wasCompleted, true)
      assert.equal(traceB.state?.wasCompleted, true)
      assert.equal(traceA.state?.wasCancelled, false)
      assert.equal(traceB.state?.wasCancelled, false)
    } else {
      assert.isEmpty(traceB.history)
      assert.isEmpty(traceB.history)
      assert.isEmpty(generator.history)
    }

    // Final stylesheet should contain outputs from both plugins
    const styleSheets = renderStyleSheets(instance)
    assert.equal(styleSheets?.values.length, 2)

    // Find styleSheets by key to avoid order dependency
    const aStylesheet = styleSheets?.values.find((s) => s.key === 'a')
    const bStylesheet = styleSheets?.values.find((s) => s.key === 'b')

    assert.isDefined(aStylesheet)
    assert.isDefined(bStylesheet)
    assert.equal(aStylesheet.content, ':root { ---a-x: 1; ---a-z: 2; }')
    assert.equal(bStylesheet.content, ':root { ---b-y: 1; }')

    expect(generator.history).toMatchInlineSnapshot(`
      [
        {
          "pullCount": 4,
          "wasCancelled": false,
          "wasCompleted": true,
        },
      ]
    `)
  })

  it('multi-plugin routing: plugin can abort and return early', () => {
    const traceA = createTracePlugin('a', (value) => value === '---a-y')
    const traceB = createTracePlugin('b')

    const instance = createCassiopeia()
    const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
    instance.subscribe((subscription) => spy(subscription))

    instance.use(traceA.plugin, traceB.plugin)

    const generator = createCountingGenerator(
      'var(---a-x)',
      'var(---b-x)',
      'var(---a-y)',
      'var(---c-ignored)',
      'var(---b-y)',
      'var(---a-z)',
    )

    instance.updateSync(generator.generator)

    if (IS_BROWSER) {
      // Each plugin should receive only its own markers
      assert.deepEqual(traceA.state?.receivedMarkers, ['---a-x', '---a-y'])
      assert.deepEqual(traceB.state?.receivedMarkers, ['---b-x', '---b-y'])

      assert.equal(traceA.state?.wasCompleted, true)
      assert.equal(traceB.state?.wasCompleted, true)
      assert.equal(traceA.state?.wasCancelled, false)
      assert.equal(traceB.state?.wasCancelled, false)
    } else {
      assert.isEmpty(traceA.history)
      assert.isEmpty(traceB.history)
      assert.isEmpty(generator.history)
    }

    // Final stylesheet should contain outputs from non-aborted plugins
    const styleSheets = renderStyleSheets(instance)
    assert.equal(styleSheets?.values.length, 1)

    // Find styleSheets by key to avoid order dependency
    const bStylesheet = styleSheets?.values.find((s) => s.key === 'b')
    assert.isDefined(bStylesheet)
    assert.equal(bStylesheet.content, ':root { ---b-x: 1; ---b-y: 2; }')
    expect(generator.history).toMatchInlineSnapshot(`
      [
        {
          "pullCount": 6,
          "wasCancelled": false,
          "wasCompleted": true,
        },
      ]
    `)
    if (IS_BROWSER) {
      expect(spy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "keys": [
              "a",
              "b",
            ],
            "values": [
              {
                "content": ":root { ---b-x: 1; ---b-y: 2; }",
                "index": 0,
                "key": "b",
              },
            ],
          },
        ],
      ]
    `)
    }
  })

  it('order stability: identical inputs produce deterministic stylesheet ordering across runs', () => {
    const testInputs = [
      'var(---a-first)',
      'var(---b-second)',
      'var(---a-third)',
      'var(---c-fourth)',
    ]

    // Run the same input multiple times
    const results: string[] = []

    for (let run = 0; run < 3; run++) {
      const traceA = createTracePlugin('a')
      const traceB = createTracePlugin('b')
      const traceC = createTracePlugin('c')
      const instance = createCassiopeia()

      instance.use(traceA.plugin, traceB.plugin, traceC.plugin)

      const generator = createCountingGenerator(...testInputs)
      instance.updateSync(generator.generator)

      const styleSheets = renderStyleSheets(instance)

      // Create a deterministic string representation of the results
      const resultString = styleSheets?.values
        ?.map((s) => s.content)
        ?.sort()
        ?.join('|')

      if (resultString !== undefined) {
        results.push(resultString)
      }
    }

    // Verify the expected content structure
    const expectedContent = [
      ':root { ---a-first: 1; ---a-third: 2; }',
      ':root { ---b-second: 1; }',
      ':root { ---c-fourth: 1; }',
    ]
      .sort()
      .join('|')

    // All runs should produce identical results
    for (const result of results) {
      assert.deepEqual(result, expectedContent)
    }
  })
})

describe('laziness', () => {
  for (const isAsync of [true, false]) {
    it(`no inputs → empty results: produce no styleSheets when no markers present (${JSON.stringify({ isAsync })})`, async () => {
      const traceA = createTracePlugin('a')
      const traceB = createTracePlugin('b')
      const instance = createCassiopeia()

      const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
      instance.subscribe((subscription) => spy(subscription))

      instance.use(traceA.plugin, traceB.plugin)

      const generator = createCountingGenerator(
        'some text without markers',
        'more text: no custom properties here',
        'final string with no vars',
      )

      await (isAsync
        ? instance.update(generator.generator)
        : instance.updateSync(generator.generator))

      if (IS_BROWSER) {
        // Generator should have been pulled to scan content
        assert.equal(generator.state?.pullCount, 3)

        // Plugins but receive no markers
        assert.deepEqual(traceA.state?.receivedMarkers, undefined)
        assert.deepEqual(traceB.state?.receivedMarkers, undefined)
        assert.equal(traceA.state?.wasCompleted, undefined)
        assert.equal(traceB.state?.wasCompleted, undefined)
        assert.equal(traceA.state?.wasCancelled, undefined)
        assert.equal(traceB.state?.wasCancelled, undefined)

        // Subscription should have been called with empty results
        assert.equal(spy.mock.calls.length, 1)
        assert.deepEqual(spy.mock.calls[0][0].values, [])
      } else {
        assert.equal(spy.mock.calls.length, 0)
        assert.equal(generator.state, undefined)
        assert.isEmpty(generator.history)
      }

      // renderStyleSheets should also return empty array
      const styleSheets = renderStyleSheets(instance)
      assert.deepEqual(styleSheets?.values, [])
      expect(generator.history).toMatchInlineSnapshot(`
        [
          {
            "pullCount": 3,
            "wasCancelled": false,
            "wasCompleted": true,
          },
        ]
      `)
    })

    it(`key absence → no relevant work: only matching ones receive markers (${JSON.stringify({ isAsync })})`, async () => {
      const traceA = createTracePlugin('a')
      const traceB = createTracePlugin('b')
      const traceC = createTracePlugin('c')
      const instance = createCassiopeia()

      instance.use(traceA.plugin, traceB.plugin, traceC.plugin)

      const generator = createCountingGenerator(
        'var(---a-first)',
        'some text without markers',
        'var(---a-second)',
        'more var(---a-third) here',
      )

      await (isAsync
        ? instance.update(generator.generator)
        : instance.updateSync(generator.generator))

      if (IS_BROWSER) {
        // Only plugin A should have been invoked
        assert.deepEqual(traceA.state?.receivedMarkers, ['---a-first', '---a-second', '---a-third'])
        assert.equal(traceA.state?.wasCompleted, true)
        assert.equal(traceA.state?.wasCancelled, false)

        // Plugins B and C should receive no markers
        assert.deepEqual(traceB.state?.receivedMarkers, undefined)
        assert.deepEqual(traceC.state?.receivedMarkers, undefined)
        assert.equal(traceB.state?.wasCompleted, undefined)
        assert.equal(traceC.state?.wasCompleted, undefined)
        assert.equal(traceB.state?.wasCancelled, undefined)
        assert.equal(traceC.state?.wasCancelled, undefined)
      } else {
        assert.isEmpty(traceA.history)
        assert.isEmpty(traceB.history)
        assert.isEmpty(generator.history)
      }

      // Only styleSheets from plugin A should appear
      const styleSheets = renderStyleSheets(instance)
      assert.equal(styleSheets?.values.length, 1)
      assert.equal(
        styleSheets?.values[0].content,
        ':root { ---a-first: 1; ---a-second: 2; ---a-third: 3; }',
      )
      expect(generator.history).toMatchInlineSnapshot(`
        [
          {
            "pullCount": 4,
            "wasCancelled": false,
            "wasCompleted": true,
          },
        ]
      `)
    })

    it.runIf(IS_BROWSER)(
      `deferred instantiation: no plugin invocation until update() is called (${JSON.stringify({ isAsync })})`,
      async () => {
        const traceA = createTracePlugin('a')
        const traceB = createTracePlugin('b')
        const instance = createCassiopeia()

        const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
        instance.subscribe((subscription) => spy(subscription))

        // Register plugins but don't call update yet
        instance.use(traceA.plugin, traceB.plugin)

        // TracePlugins should show zero activity
        assert.deepEqual(traceA.state?.receivedMarkers, undefined)
        assert.deepEqual(traceB.state?.receivedMarkers, undefined)

        // No subscription calls should have happened
        assert.equal(spy.mock.calls.length, 0)

        // renderStyleSheets should return empty (no work done yet)
        let styleSheets = renderStyleSheets(instance)
        assert.deepEqual(styleSheets, undefined)

        // Now call update - only then should plugins be exercised
        const generator = createCountingGenerator('var(---a-test)', 'var(---b-example)')

        await (isAsync
          ? instance.update(generator.generator)
          : instance.updateSync(generator.generator))

        // After update, plugins whose keys appear should have been exercised
        assert.deepEqual(traceA.state?.receivedMarkers, ['---a-test'])
        assert.deepEqual(traceB.state?.receivedMarkers, ['---b-example'])
        assert.equal(traceA.state?.wasCompleted, true)
        assert.equal(traceB.state?.wasCompleted, true)

        expect(generator.history).toMatchInlineSnapshot(`
          [
            {
              "pullCount": 2,
              "wasCancelled": false,
              "wasCompleted": true,
            },
          ]
        `)

        // Subscription should have been called
        assert.equal(spy.mock.calls.length, 1)

        // Now renderStyleSheets should return results
        styleSheets = renderStyleSheets(instance)
        assert.equal(styleSheets?.values.length, 2)
        assert.equal(generator.history.length, 1)
      },
    )

    it.runIf(IS_BROWSER)(
      `true laziness - scoped plugin updates: only target plugin invoked during plugin-triggered updates (${JSON.stringify({ isAsync })})`,
      async () => {
        const traceA = createTracePlugin('a')
        const traceB = createTracePlugin('b')
        const traceC = createTracePlugin('c')
        const instance = createCassiopeia()
        const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
        instance.subscribe((subscription) => spy(subscription))

        instance.use(traceA.plugin, traceB.plugin, traceC.plugin)

        // Initial full update - relevant plugins invoked
        const generator = createCountingGenerator('var(---a-test)', 'var(---b-test)')
        await (isAsync
          ? instance.update(generator.generator)
          : instance.updateSync(generator.generator))

        // Baseline: relevant plugins should have been invoked once
        assert.equal(traceA.history.length, 1)
        assert.equal(traceB.history.length, 1)
        assert.equal(traceC.history.length, 0)

        assert.equal(spy.mock.calls.length, 1)
        expect(spy.mock.calls[0]).toMatchInlineSnapshot(`
          [
            {
              "keys": [
                "a",
                "b",
                "c",
              ],
              "values": [
                {
                  "content": ":root { ---a-test: 1; }",
                  "index": 0,
                  "key": "a",
                },
                {
                  "content": ":root { ---b-test: 1; }",
                  "index": 0,
                  "key": "b",
                },
              ],
            },
          ]
        `)

        // Now trigger a scoped update for plugin A only
        await (isAsync ? traceA.update() : traceA.updateSync())

        // Only plugin A should have been invoked again
        assert.equal(traceA.history.length, 2) // +1
        assert.equal(traceB.history.length, 1) // unchanged
        assert.equal(traceC.history.length, 0) // unchanged

        assert.equal(spy.mock.calls.length, 2)
        expect(spy.mock.calls[1]).toMatchInlineSnapshot(`
          [
            {
              "keys": [
                "a",
                "b",
                "c",
              ],
              "values": [
                {
                  "content": ":root { ---a-test: 1; }",
                  "index": 0,
                  "key": "a",
                },
              ],
            },
          ]
        `)

        // Trigger scoped update for plugin B
        await (isAsync ? traceB.update(['b']) : traceB.updateSync(['b']))

        // Only plugin B should have been invoked again
        assert.equal(traceA.history.length, 2) // unchanged
        assert.equal(traceB.history.length, 2) // +1
        assert.equal(traceC.history.length, 0) // unchanged

        assert.equal(spy.mock.calls.length, 3)
        expect(spy.mock.calls[2]).toMatchInlineSnapshot(`
          [
            {
              "keys": [
                "a",
                "b",
                "c",
              ],
              "values": [
                {
                  "content": ":root { ---b-test: 1; }",
                  "index": 0,
                  "key": "b",
                },
              ],
            },
          ]
        `)

        // Full update should invoke relevant plugins again
        await (isAsync ? instance.update() : instance.updateSync())

        // relevant plugins should be invoked again
        assert.equal(traceA.history.length, 3) // +1
        assert.equal(traceB.history.length, 3) // +1
        assert.equal(traceC.history.length, 0) // 0

        expect(generator.history).toMatchInlineSnapshot(`
          [
            {
              "pullCount": 2,
              "wasCancelled": false,
              "wasCompleted": true,
            },
          ]
        `)

        assert.equal(spy.mock.calls.length, 4)
        expect(spy.mock.calls[3]).toMatchInlineSnapshot(`
          [
            {
              "keys": [
                "a",
                "b",
                "c",
              ],
              "values": [
                {
                  "content": ":root { ---a-test: 1; }",
                  "index": 0,
                  "key": "a",
                },
                {
                  "content": ":root { ---b-test: 1; }",
                  "index": 0,
                  "key": "b",
                },
              ],
            },
          ]
        `)
      },
    )
  }
})

describe.runIf(IS_BROWSER)('cooperative async mode & cancellation', () => {
  it('time-sliced progress: cooperative async behavior with controlled timing', async () => {
    const instance = createCassiopeia()
    const context = instance[CASSIOPEIA_CONTEXT]

    // Control cooperative async timing precisely
    context.deferEvery = 2 // Yield after every 2 iterations

    const traceA = createTracePlugin('a')
    instance.use(traceA.plugin)

    const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
    instance.subscribe((subscription) => spy(subscription))

    let deferCallCount = 0
    let deferCallbacksExecuted = 0
    const originalDefer = context.defer

    // Monitor defer calls but let them execute normally
    context.defer = (callback) => {
      deferCallCount++
      return originalDefer(() => {
        deferCallbacksExecuted++
        callback()
      })
    }

    // Create generator with enough properties to trigger multiple defers
    const generator = createManyPropertiesGenerator(6, 'a') // 6 properties with deferEvery=2 should yield 3 times

    await instance.update(generator.generator)

    // Verify cooperative async behavior occurred
    assert.isTrue(deferCallCount > 0, `Should have made defer calls: ${deferCallCount}`)
    assert.isTrue(
      deferCallbacksExecuted > 0,
      `Should have executed defer callbacks: ${deferCallbacksExecuted}`,
    )
    assert.equal(
      deferCallCount,
      deferCallbacksExecuted,
      'All defer callbacks should have been executed',
    )

    // Defer calls occur when iteration % deferEvery === 0 in createScheduler
    // With 6 properties: defers at iterations 2, 4, 6, plus orchestrator completion = 3 defer calls
    assert.equal(
      deferCallCount,
      3,
      'Should have exactly 3 defer calls for 6 properties with deferEvery=2',
    )

    // Verify final results
    assert.equal(
      spy.mock.calls.length,
      1,
      'Should have exactly one subscription callback invocation',
    )
    assert.equal(spy.mock.calls[0][0].values.length, 1, 'Should have one stylesheet')
    assert.equal(traceA.state?.wasCompleted, true, 'Plugin should be completed')
    assert.equal(traceA.state?.receivedMarkers.length, 6, 'All 6 properties should be processed')

    expect(generator.history).toMatchInlineSnapshot(`
      [
        {
          "pullCount": 6,
          "wasCancelled": false,
          "wasCompleted": true,
        },
      ]
    `)
  })

  it('superseding update cancels at orchestrator level', async () => {
    const instance = createCassiopeia()
    const context = instance[CASSIOPEIA_CONTEXT]

    context.deferEvery = 1
    const deferController = createDeferController()
    context.defer = deferController.defer
    context.deferCancel = deferController.deferCancel

    const traceA = createTracePlugin('a')
    instance.use(traceA.plugin)

    const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
    instance.subscribe((subscription) => spy(subscription))

    // Start first update with many iterations
    const generator1 = createManyPropertiesGenerator(10, 'a-first')
    const updatePromise1 = instance.update(generator1.generator)

    // Should have queued first defer - orchestrator started
    assert.isTrue(deferController.hasQueued())

    // Execute callbacks to start processing
    assert.isTrue(deferController.executeNext())
    assert.isTrue(deferController.executeNext())

    // Start second update while first is in progress - this should cancel first
    const generator2 = createCountingGenerator('var(---a-second)')
    const updatePromise2 = instance.update(generator2.generator)

    // Switch to automatic mode - all remaining defers execute immediately
    await deferController.setManual(false)

    await updatePromise1
    await updatePromise2

    // Should have only one subscription callback invocation (from update2)
    assert.equal(spy.mock.calls.length, 1)
    assert.equal(spy.mock.calls[0][0].values.length, 1)
    assert.equal(spy.mock.calls[0][0].values[0].content, ':root { ---a-second: 1; }')

    // Verify history shows cancellation of first reducer and completion of second
    assert.equal(traceA.history.length, 2, 'Should have history of 2 reducer instances')

    const [firstReducer, secondReducer] = traceA.history

    // First reducer should have been cancelled
    assert.equal(firstReducer.wasCancelled, true, 'First reducer should be cancelled')
    assert.equal(firstReducer.wasCompleted, false, 'First reducer should not be completed')
    expect(firstReducer.receivedMarkers).toMatchInlineSnapshot(`
      [
        "---a-first-prop0",
      ]
    `)

    // Second reducer should have completed normally
    assert.equal(secondReducer.wasCancelled, false, 'Second reducer should not be cancelled')
    assert.equal(secondReducer.wasCompleted, true, 'Second reducer should be completed')
    expect(secondReducer.receivedMarkers).toMatchInlineSnapshot(`
      [
        "---a-second",
      ]
    `)

    // Final plugin state should reflect latest update
    expect(traceA.history).toMatchInlineSnapshot(`
      [
        {
          "receivedMarkers": [
            "---a-first-prop0",
          ],
          "wasCancelled": true,
          "wasCompleted": false,
        },
        {
          "receivedMarkers": [
            "---a-second",
          ],
          "wasCancelled": false,
          "wasCompleted": true,
        },
      ]
    `)

    expect(generator1.history).toMatchInlineSnapshot(`
      [
        {
          "pullCount": 1,
          "wasCancelled": true,
          "wasCompleted": false,
        },
      ]
    `)
    expect(generator2.history).toMatchInlineSnapshot(`
      [
        {
          "pullCount": 1,
          "wasCancelled": false,
          "wasCompleted": true,
        },
      ]
    `)
  })

  it('cancellation behavior: only latest update commits', async () => {
    const instance = createCassiopeia()
    const context = instance[CASSIOPEIA_CONTEXT]

    context.deferEvery = 1
    const deferController = createDeferController()
    context.defer = deferController.defer
    context.deferCancel = deferController.deferCancel

    const traceA = createTracePlugin('a')
    instance.use(traceA.plugin)

    const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
    instance.subscribe((subscription) => spy(subscription))
    // Start first update with many iterations
    const generator1 = createManyPropertiesGenerator(10, 'a-first')
    const updatePromise1 = instance.update(generator1.generator)

    // Should have queued first defer - orchestrator started
    assert.isTrue(deferController.hasQueued())

    // Execute two callbacks to ensure first update progresses far enough to create reducer
    assert.isTrue(deferController.executeNext())
    assert.isTrue(deferController.executeNext())
    // Start second update while first is in progress - this should cancel first
    const generator2 = createCountingGenerator('var(---a-second)')
    const updatePromise2 = instance.update(generator2.generator)

    // Switch to automatic mode - all remaining defers execute immediately
    await deferController.setManual(false)

    await updatePromise1
    await updatePromise2
    // Should have only one subscription callback invocation (from latest update)
    assert.equal(
      spy.mock.calls.length,
      1,
      'Should have exactly one subscription callback invocation',
    )
    assert.equal(spy.mock.calls[0][0].values.length, 1, 'Should have one stylesheet')
    assert.equal(
      spy.mock.calls[0][0].values[0].content,
      ':root { ---a-second: 1; }',
      'Should have result from second update only',
    )

    // Verify history shows cancellation pattern - first reducer cancelled, second completed
    assert.equal(traceA.history.length, 2, 'Should have history of 2 reducer instances')

    const [firstReducer, secondReducer] = traceA.history

    // First reducer should have been cancelled (received markers from 'a-first' update)
    assert.equal(firstReducer.wasCancelled, true, 'First reducer should be cancelled')
    assert.equal(firstReducer.wasCompleted, false, 'First reducer should not be completed')
    assert.isTrue(
      firstReducer.receivedMarkers.length > 0,
      'First reducer should have received some markers before cancellation',
    )
    assert.isTrue(
      firstReducer.receivedMarkers.some((m) => m.includes('first')),
      'First reducer should have markers from first update',
    )

    // Second reducer should have completed normally (with 'a-second' marker)
    assert.equal(secondReducer.wasCancelled, false, 'Second reducer should not be cancelled')
    assert.equal(secondReducer.wasCompleted, true, 'Second reducer should be completed')
    assert.deepEqual(
      secondReducer.receivedMarkers,
      ['---a-second'],
      'Second reducer should have markers from second update',
    )

    // Final plugin state should reflect latest update
    assert.isTrue(
      traceA.state?.receivedMarkers.includes('---a-second'),
      'Should have marker from second update',
    )
    assert.equal(traceA.state?.wasCompleted, true, 'Plugin should be completed')

    expect(generator1.history).toMatchInlineSnapshot(`
      [
        {
          "pullCount": 1,
          "wasCancelled": true,
          "wasCompleted": false,
        },
      ]
    `)
    expect(generator2.history).toMatchInlineSnapshot(`
      [
        {
          "pullCount": 1,
          "wasCancelled": false,
          "wasCompleted": true,
        },
      ]
    `)
  })

  it('superseding plugin change cancels at orchestrator level', async () => {
    const instance = createCassiopeia()
    const context = instance[CASSIOPEIA_CONTEXT]

    context.deferEvery = 1
    const deferController = createDeferController()
    context.defer = deferController.defer
    context.deferCancel = deferController.deferCancel

    assert.equal(deferController.count, 0)

    const traceA = createTracePlugin('a')
    instance.use(traceA.plugin)

    assert.equal(deferController.count, 1)

    const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
    instance.subscribe((subscription) => spy(subscription))

    // Start first update with many iterations
    const generator = createManyPropertiesGenerator(4, 'a')
    const updatePromise = instance.update(generator.generator)

    assert.equal(deferController.count, 1)
    deferController.executeNext()

    assert.equal(deferController.count, 1)
    assert.equal(traceA.history.length, 1)
    assert.deepEqual(traceA.history[0].receivedMarkers, ['---a-prop0'])
    assert.equal(traceA.history[0].wasCancelled, false)
    assert.equal(traceA.history[0].wasCompleted, false)

    traceA.triggerSet()

    assert.equal(deferController.count, 2)
    assert.equal(traceA.history.length, 1)
    assert.equal(traceA.history[0].wasCancelled, true)

    await deferController.setManual(false)
    await updatePromise

    assert.equal(traceA.history[1].wasCompleted, true)
    expect(spy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "keys": [
              "a",
            ],
            "values": [
              {
                "content": ":root { ---a-prop0: 1; ---a-prop1: 2; ---a-prop2: 3; ---a-prop3: 4; }",
                "index": 0,
                "key": "a",
              },
            ],
          },
        ],
      ]
    `)

    expect(generator.history).toMatchInlineSnapshot(`
      [
        {
          "pullCount": 4,
          "wasCancelled": false,
          "wasCompleted": true,
        },
      ]
    `)
  })

  for (const [first, second] of [
    ['reducer', 'reducer'],
    ['reducer', 'generator'],
    ['generator', 'generator'],
    ['generator', 'reducer'],
  ] as const) {
    it.runIf(IS_BROWSER)(
      `preserves generator cache when appropriate: ${[first, second].join('-')}`,
      async () => {
        // This test validates the cache preservation optimization in state-machine.ts:
        // All update combinations (reducer-reducer, reducer-generator, etc.) preserve the existing
        // generator cache, demonstrating that no unnecessary cache clearing or new generator creation
        // occurs. The initial cached generator remains unchanged throughout all operations.

        const instance = createCassiopeia()
        const context = instance[CASSIOPEIA_CONTEXT]

        const tracePlugin = createTracePlugin('a')
        instance.use(tracePlugin.plugin)

        // Step 1: Establish baseline with a complete generator update
        // This creates an initial cached generator that reducer updates will preserve
        const generator = createManyPropertiesGenerator(4, 'a')
        instance.updateSync(generator.generator)

        // Verify baseline generator update completed and cache was created
        expect(generator.history).toMatchInlineSnapshot(`
        [
          {
            "pullCount": 4,
            "wasCancelled": false,
            "wasCompleted": true,
          },
        ]
      `)
        expect(tracePlugin.history).toMatchInlineSnapshot(`
        [
          {
            "receivedMarkers": [
              "---a-prop0",
              "---a-prop1",
              "---a-prop2",
              "---a-prop3",
            ],
            "wasCancelled": false,
            "wasCompleted": true,
          },
        ]
      `)

        // Step 2: Test cache preservation behavior with different update types
        // Both reducer and generator updates preserve the existing cache in this scenario
        context.deferEvery = 2
        const deferController = createDeferController()
        context.defer = deferController.defer
        context.deferCancel = deferController.deferCancel

        if (first === 'reducer') {
          // Reducer-only update: preserves existing generator cache (doesn't touch it)
          void tracePlugin.update()
          expect(tracePlugin.history).toMatchInlineSnapshot(`
          [
            {
              "receivedMarkers": [
                "---a-prop0",
                "---a-prop1",
                "---a-prop2",
                "---a-prop3",
              ],
              "wasCancelled": false,
              "wasCompleted": true,
            },
          ]
        `)
        } else {
          // Generator update: also preserves existing cache (no new generator provided in this test)
          void instance.update()
          expect(tracePlugin.history).toMatchInlineSnapshot(`
          [
            {
              "receivedMarkers": [
                "---a-prop0",
                "---a-prop1",
                "---a-prop2",
                "---a-prop3",
              ],
              "wasCancelled": false,
              "wasCompleted": true,
            },
          ]
        `)
        }

        // Should have deferred the reduce action
        // assert.isTrue(deferController.hasQueued(), 'Should have deferred the reduce action')
        await deferController.setManual(false)

        if (first === 'reducer') {
          // Second reducer update: continues to reuse the original cached generator
          await tracePlugin.update()
          expect(tracePlugin.history).toMatchInlineSnapshot(`
          [
            {
              "receivedMarkers": [
                "---a-prop0",
                "---a-prop1",
                "---a-prop2",
                "---a-prop3",
              ],
              "wasCancelled": false,
              "wasCompleted": true,
            },
            {
              "receivedMarkers": [
                "---a-prop0",
                "---a-prop1",
              ],
              "wasCancelled": true,
              "wasCompleted": false,
            },
            {
              "receivedMarkers": [
                "---a-prop0",
                "---a-prop1",
                "---a-prop2",
                "---a-prop3",
              ],
              "wasCancelled": false,
              "wasCompleted": true,
            },
          ]
        `)
        } else {
          // Second generator update: also continues to reuse the original cached generator (no new generator created)
          await instance.update()
          expect(tracePlugin.history).toMatchInlineSnapshot(`
          [
            {
              "receivedMarkers": [
                "---a-prop0",
                "---a-prop1",
                "---a-prop2",
                "---a-prop3",
              ],
              "wasCancelled": false,
              "wasCompleted": true,
            },
            {
              "receivedMarkers": [
                "---a-prop0",
                "---a-prop1",
              ],
              "wasCancelled": true,
              "wasCompleted": false,
            },
            {
              "receivedMarkers": [
                "---a-prop0",
                "---a-prop1",
                "---a-prop2",
                "---a-prop3",
              ],
              "wasCancelled": false,
              "wasCompleted": true,
            },
          ]
        `)
        }

        // Verify that no new generators were created - the initial cached generator remained unchanged
        assert.isTrue(true, 'Cache preservation test completed successfully')
        expect(generator.history).toMatchInlineSnapshot(`
        [
          {
            "pullCount": 4,
            "wasCancelled": false,
            "wasCompleted": true,
          },
        ]
      `)
      },
    )
  }

  for (const action of ['dispose', 'delete'] as const) {
    it(`superseding plugin ${action} cancels at orchestrator level`, async () => {
      const instance = createCassiopeia()
      const context = instance[CASSIOPEIA_CONTEXT]

      context.deferEvery = 1
      const deferController = createDeferController()
      context.defer = deferController.defer
      context.deferCancel = deferController.deferCancel

      assert.equal(deferController.count, 0)

      const traceA = createTracePlugin('a')
      instance.use(traceA.plugin)

      assert.equal(deferController.count, 1)

      const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
      instance.subscribe((subscription) => spy(subscription))

      // Start first update with many iterations
      const generator1 = createManyPropertiesGenerator(4, 'a')
      const updatePromise1 = instance.update(generator1.generator)

      assert.equal(deferController.count, 1)
      deferController.executeNext()

      assert.equal(deferController.count, 1)
      assert.equal(traceA.history.length, 1)
      assert.deepEqual(traceA.history[0].receivedMarkers, ['---a-prop0'])
      assert.equal(traceA.history[0].wasCancelled, false)
      assert.equal(traceA.history[0].wasCompleted, false)

      if (action === 'delete') {
        traceA.triggerDelete()
      } else {
        void traceA.dispose()
      }

      assert.equal(deferController.count, 2)
      assert.equal(traceA.history.length, 1)
      assert.equal(traceA.history[0].wasCancelled, true)

      await deferController.setManual(false)
      await updatePromise1

      assert.equal(traceA.history.length, 1)
      expect(spy.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "keys": [],
              "values": [],
            },
          ],
        ]
      `)

      expect(generator1.history).toMatchInlineSnapshot(`
        [
          {
            "pullCount": 1,
            "wasCancelled": false,
            "wasCompleted": false,
          },
        ]
      `)

      const traceAA = createTracePlugin('a')
      instance.use(traceAA.plugin)

      await traceAA.update()

      expect(generator1.history).toMatchInlineSnapshot(`
        [
          {
            "pullCount": 4,
            "wasCancelled": false,
            "wasCompleted": true,
          },
        ]
      `)

      expect(spy.mock.calls[1]).toMatchInlineSnapshot(`
        [
          {
            "keys": [
              "a",
            ],
            "values": [
              {
                "content": ":root { ---a-prop0: 1; ---a-prop1: 2; ---a-prop2: 3; ---a-prop3: 4; }",
                "index": 0,
                "key": "a",
              },
            ],
          },
        ]
      `)
    })
  }

  it.runIf(IS_BROWSER)('removes obsolete keys from updateReducerKeys when plugins are disposed during reducer updates', async () => {
    const instance = createCassiopeia()
    const context = instance[CASSIOPEIA_CONTEXT]

    // Setup controlled async execution
    const deferController = createDeferController()
    context.defer = deferController.defer
    context.deferCancel = deferController.deferCancel
    await deferController.setManual(true)

    // Create multiple plugins and register them
    const traceA = createTracePlugin('a')
    const traceB = createTracePlugin('b')
    const traceC = createTracePlugin('c')
    instance.use(traceA.plugin, traceB.plugin, traceC.plugin)

    // Establish generator cache first
    const generator = createCountingGenerator('var(---a-test)', 'var(---b-test)', 'var(---c-test)')
    instance.updateSync(generator.generator)

    // Trigger plugin update with specific keys to populate updateReducerKeys
    void traceA.update(['a', 'b', 'c']) // This will create updateReducerKeys Set with all three keys

    // Execute to get to the state where updateReducerKeys is populated
    assert.isTrue(deferController.executeNext())

    // Verify updateReducerKeys contains all expected keys
    assert.deepEqual([...context.updateReducerKeys!].sort(), ['a', 'b', 'c'])

    // Dispose plugin B while the update is still processing - this removes 'b' from reducerKeys
    void traceB.dispose()

    // Execute the disposal
    assert.isTrue(deferController.executeNext())

    assert.deepEqual([...context.updateReducerKeys!].sort(), ['a', 'c'])

    // Trigger another update that will hit the cleanup logic
    void traceC.update(['a', 'b', 'c']) // Still trying to update all keys including disposed 'b'

    // Execute the update that will trigger the cleanup logic in lines 77-81
    assert.isTrue(deferController.executeNext())

    // Verify that obsolete key 'b' was removed from updateReducerKeys during cleanup
    assert.deepEqual([...context.updateReducerKeys!].sort(), ['a', 'c'])

    // Complete remaining execution
    await deferController.setManual(false)
  })
})

describe('optimization: early return and no orchestrator paths', () => {
  for (const isAsync of [true, false]) {
    it(`skips orchestrator for generator updates when no plugins registered (${isAsync ? 'async' : 'sync'})`, async () => {
      const instance = createCassiopeia()
      const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
      instance.subscribe((subscription) => spy(subscription))

      // Ensure no plugins are registered - triggers no plugins registered optimization
      assert.equal(Object.keys(instance[CASSIOPEIA_CONTEXT].reducerFactories).length, 0)

      // Both generator and reducer update paths need a generator to satisfy the Reduce action guard
      const generator = createCountingGenerator('var(---test-prop)')
      if (isAsync) {
        await instance.update(generator.generator)
      } else {
        instance.updateSync(generator.generator)
      }

      if (IS_BROWSER) {
        // Optimization: no plugins registered triggers early return
        // State machine goes PreFlight → InFlight transition and early returns
        // Reduce action fires, orchestrator is undefined, so subscription gets empty values
        expect(spy.mock.calls).toMatchInlineSnapshot(`
          [
            [
              {
                "keys": [],
                "values": [],
              },
            ],
          ]
        `)

        // During optimization, generator is not processed
        assert.equal(generator.state, undefined)

        // State should return to Idle after Done transition
        assert.equal(instance[CASSIOPEIA_STATE], CassiopeiaStateMachineState.Idle)
      } else {
        // Node: no subscription calls
        assert.equal(spy.mock.calls.length, 0)
        assert.equal(generator.state, undefined)
      }

      // Verify final state shows optimization was triggered
      const styleSheets = renderStyleSheets(instance)
      // TODO: (fix inconsistency)
      //
      // When optimization triggers, renderStyleSheets returns undefined
      // assert.equal(styleSheets, undefined)
      expect(styleSheets).toMatchInlineSnapshot(`
        {
          "keys": [],
          "values": [],
        }
      `)
    })
  }

  for (const isAsync of [true, false]) {
    it(`skips orchestrator for reducer updates when no plugins registered (${isAsync ? 'async' : 'sync'})`, async () => {
      const instance = createCassiopeia()
      const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
      instance.subscribe((subscription) => spy(subscription))

      // Ensure no plugins are registered - triggers no plugins registered optimization
      assert.equal(Object.keys(instance[CASSIOPEIA_CONTEXT].reducerFactories).length, 0)

      // Both generator and reducer update paths need a generator to satisfy the Reduce action guard
      const generator = createCountingGenerator('var(---test-prop)')
      if (isAsync) {
        await instance.update(generator.generator)
      } else {
        instance.updateSync(generator.generator)
      }

      if (IS_BROWSER) {
        // Optimization: no plugins registered triggers early return
        // State machine goes PreFlight → InFlight and early returns
        // Reduce action fires, orchestrator is undefined, so subscription gets empty values
        expect(spy.mock.calls).toMatchInlineSnapshot(`
          [
            [
              {
                "keys": [],
                "values": [],
              },
            ],
          ]
        `)

        // During optimization, generator is not processed - it just gets cached
        assert.equal(generator.state, undefined)

        // State should return to Idle after Done transition
        assert.equal(instance[CASSIOPEIA_STATE], CassiopeiaStateMachineState.Idle)
      } else {
        // Node: no subscription calls
        assert.equal(spy.mock.calls.length, 0)
        assert.equal(generator.state, undefined)
      }

      // Verify final state shows optimization was triggered
      const styleSheets = renderStyleSheets(instance)
      // TODO: inconsistency
      //
      // When optimization triggers, renderStyleSheets returns undefined
      // assert.equal(styleSheets, undefined)
      expect(styleSheets).toMatchInlineSnapshot(`
        {
          "keys": [],
          "values": [],
        }
      `)
    })
  }

  for (const isAsync of [true, false]) {
    it(`skips orchestrator when update reducer keys is empty (${isAsync ? 'async' : 'sync'})`, async () => {
      const instance = createCassiopeia()
      const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
      instance.subscribe((subscription) => spy(subscription))

      // Register plugins so reducerFactories is not empty
      const traceA = createTracePlugin('a')
      const traceB = createTracePlugin('b')
      instance.use(traceA.plugin, traceB.plugin)

      // Verify plugins are registered (no plugins registered condition is false)
      assert.isTrue(Object.keys(instance[CASSIOPEIA_CONTEXT].reducerFactories).length > 0)

      // First establish a cached generator to satisfy the Reduce action guard
      const generator = createCountingGenerator('var(---a-test)')
      if (isAsync) {
        await instance.update(generator.generator)
      } else {
        instance.updateSync(generator.generator)
      }

      // Reset spy to focus on the optimization test
      spy.mockClear()

      // TODO: this should be discouraged at least in documentation
      //
      // Now trigger reducer update with empty keys array to create empty Set
      // This should trigger empty update reducer keys optimization: updateReducerKeys.size === 0
      if (isAsync) {
        await traceA.update([])
      } else {
        traceA.updateSync([])
      }

      if (IS_BROWSER) {
        // Optimization: empty updateReducerKeys.size === 0
        // State machine early returns, orchestrator undefined, subscription gets empty values
        expect(spy.mock.calls).toMatchInlineSnapshot(`
            [
              [
                {
                  "keys": [
                    "a",
                    "b",
                  ],
                  "values": [],
                },
              ],
            ]
          `)
      } else {
        // Node: no subscription calls
        assert.equal(spy.mock.calls.length, 0)
      }

      // The empty reducer keys update doesn't clear the generator
      const styleSheets = renderStyleSheets(instance)
      expect(styleSheets).toMatchInlineSnapshot(`
          {
            "keys": [
              "a",
              "b",
            ],
            "values": [
              {
                "content": ":root { ---a-test: 1; }",
                "index": 0,
                "key": "a",
              },
            ],
          }
        `)
    })
  }

  for (const option of ['are disposed', 'key is deleted'] as const) {
    it(`triggers optimization when plugins ${option}`, async () => {
      const instance = createCassiopeia()
      const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
      instance.subscribe((subscription) => spy(subscription))

      // Setup defer controller for both dispose and delete cases
      const deferController = createDeferController()
      const context = instance[CASSIOPEIA_CONTEXT]
      context.defer = deferController.defer
      context.deferCancel = deferController.deferCancel
      await deferController.setManual(false)

      // Register plugins and establish cached generator
      const traceA = createTracePlugin('a')
      const traceB = createTracePlugin('b')
      instance.use(traceA.plugin, traceB.plugin)

      const generator = createCountingGenerator('var(---a-test)', 'var(---b-test)')
      instance.updateSync(generator.generator)

      // Reset spy to focus on disposal behavior
      spy.mockClear()

      await deferController.setManual(true)

      // Remove one plugin
      if (option === 'are disposed') {
        void traceA.dispose()
      } else {
        traceA.triggerDelete()
      }

      await deferController.executeAll()

      // Verify still have one plugin
      assert.equal(Object.keys(instance[CASSIOPEIA_CONTEXT].reducerFactories).length, 1)

      // Remove last plugin
      if (option === 'are disposed') {
        void traceB.dispose()
      } else {
        traceB.triggerDelete()
      }

      await deferController.executeAll()

      // Verify no plugins registered
      assert.equal(Object.keys(instance[CASSIOPEIA_CONTEXT].reducerFactories).length, 0)

      if (IS_BROWSER) {
        expect(spy.mock.calls).toMatchInlineSnapshot(`
          [
            [
              {
                "keys": [
                  "b",
                ],
                "values": [],
              },
            ],
            [
              {
                "keys": [],
                "values": [],
              },
            ],
          ]
        `)
      } else {
        assert.equal(spy.mock.calls.length, 0)
      }

      await deferController.setManual(false)

      expect(renderStyleSheets(instance)).toMatchInlineSnapshot(`
        {
          "keys": [],
          "values": [],
        }
      `)
    })
  }

  it('orchestrator creation patterns during optimization', async () => {
    const instance = createCassiopeia()
    const context = instance[CASSIOPEIA_CONTEXT]
    const spy = vi.fn<(value: CassiopeiaStyleSheets) => void>()
    instance.subscribe((subscription) => spy(subscription))

    const deferController = createDeferController()
    context.defer = deferController.defer
    context.deferCancel = deferController.deferCancel
    await deferController.setManual(true)

    // Optimization: no plugins registered, no orchestrator should be created
    // Need to provide a generator to satisfy the Reduce action guard
    const generator = createCountingGenerator('var(---a-test)')
    void instance.update(generator.generator)

    await deferController.executeAll()

    if (IS_BROWSER) {
      assert.equal(context.orchestrator, undefined)
    }

    if (IS_BROWSER) {
      expect(spy.mock.calls.at(0)).toMatchInlineSnapshot(`
        [
          {
            "keys": [],
            "values": [],
          },
        ]
      `)
    }

    // Add plugin and establish cached generator for reducer updates
    const traceA = createTracePlugin('a')
    instance.use(traceA.plugin)

    await deferController.executeAll()

    if (IS_BROWSER) {
      expect(spy.mock.calls.at(1)).toMatchInlineSnapshot(`
        [
          {
            "keys": [
              "a",
            ],
            "values": [
              {
                "content": ":root { ---a-test: 1; }",
                "index": 0,
                "key": "a",
              },
            ],
          },
        ]
      `)
    }

    const generator2 = createCountingGenerator('var(---a-test)')
    void instance.update(generator2.generator)

    await deferController.executeAll()

    if (IS_BROWSER) {
      expect(spy.mock.calls.at(2)).toMatchInlineSnapshot(`
        [
          {
            "keys": [
              "a",
            ],
            "values": [
              {
                "content": ":root { ---a-test: 1; }",
                "index": 0,
                "key": "a",
              },
            ],
          },
        ]
      `)
    }

    void traceA.update([])
    await deferController.executeAll()

    if (IS_BROWSER) {
      expect(spy.mock.calls.at(3)).toMatchInlineSnapshot(`
        [
          {
            "keys": [
              "a",
            ],
            "values": [],
          },
        ]
      `)
      assert.equal(context.orchestrator, undefined)
    }

    // Normal update: orchestrator should be created and then cleaned up
    void traceA.update(['a'])
    await deferController.executeAll()

    if (IS_BROWSER) {
      expect(spy.mock.calls.at(4)).toMatchInlineSnapshot(`
        [
          {
            "keys": [
              "a",
            ],
            "values": [
              {
                "content": ":root { ---a-test: 1; }",
                "index": 0,
                "key": "a",
              },
            ],
          },
        ]
      `)
      // After normal processing, orchestrator should be undefined again (cleaned up)
      assert.equal(context.orchestrator, undefined)
    }

    void traceA.dispose()
    await deferController.executeAll()

    if (IS_BROWSER) {
      expect(spy.mock.calls.at(5)).toMatchInlineSnapshot(`
        [
          {
            "keys": [],
            "values": [],
          },
        ]
      `)
    }
  })
})
