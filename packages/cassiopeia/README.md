# cassiopeia

Cassiopeia generates CSS at runtime from Triple-dash CSS Custom Properties (`var(---key-suffix)`) processed through user-defined plugins. Subscriptions determine where generated stylesheets are applied in browser, and server contexts.

## Introduction

Cassiopeia generates CSS at runtime from Triple-dash CSS Custom Properties (`var(---key-suffix)`) processed through user-defined plugins. Triple-dash CSS Custom Properties serve as generation directives that trigger stylesheet production. Plugins register reducers that transform those into CSS rules using custom logic defined by plugin reducers. Generator-based architecture enables streaming and incremental processing, while reducers execute lazily with cancellation primitives, batch accumulation, and async/sync execution modes. This architecture suits scenarios requiring CSS generation responsive to runtime application state and information architecture where styling logic cannot be predetermined at build time.

Cassiopeia provides infrastructure primitives rather than a complete framework. Plugins implement reducers, define transformation logic, and control when processing occurs. The library handles generator caching, lazy reducer execution, cancellation, batching, and subscription management. Plugins decide what triple-dash properties mean, what CSS they produce, and when to trigger updates. Cassiopeia does not suit static design systems where all styles are predetermined at build time.

## Architecture

### Plugins

Register reducer factories by key via the `reducerFactories` proxy. Each reducer factory creates a reducer that processes Triple‑dash CSS Custom Properties and produces stylesheets. The `reducerFactories` proxy automatically triggers updates when factories are added or removed, maintaining a synchronized set of registered keys. Plugin context provides `update(keys?)` and `updateSync(keys?)` to re-execute the plugin's reducers without supplying a new generator. The optional `keys` argument targets specific reducer keys; if omitted, all registered keys for that plugin are processed. Plugin context provides `dispose()` to remove the plugin, clean up its registered keys, and trigger an update.

### Execution Modes

Synchronous mode (`updateSync`) executes a run to completion without yielding. Asynchronous mode (`update`) processes Triple‑dash CSS Custom Properties in chunks, yielding control to the event loop every `deferEvery` iterations (default: 8) to allow rendering, user interactions, and other tasks to proceed.

### Laziness

Instance updates accept optional generator factories. Supplying a new factory creates a fresh generator with an empty cache; omitting it preserves the existing generator and cache. When async updates batch, only the most recent supplied generator factory is used. Plugin updates have no generator parameter and always reuse the existing generator.

Plugins register reducer factories by key. Reducers are created lazily on first access within a run, then cached for that run's duration and recreated for subsequent runs. Plugin updates can target specific reducer keys. Async updates combine multiple reducer keys within a batch and execute only those reducers. Sync updates process each update sequentially without batching but still execute only targeted reducer keys.

In browsers, updates execute runs automatically. In Node.js, updates prepare state but defer execution until `renderStyleSheets()` is called.

### Caching

Instance updates that provide a generator factory wrap the generator in a cache, storing yielded `[key, suffix]` pairs as the generator produces them. Pairs are appended to the cache as the generator yields them. Multiple reducers read from this shared cache during the run. Once the generator completes, the cache is marked complete and can replay without re-executing the generator.

Any new update — whether via `update` (asynchronous) or `updateSync` (synchronous), and whether or not it supplies a new generator — cancels the in-flight run. Canceled runs preserve the generator cache. The next run reuses this cache unless a new generator factory is supplied.

In browsers, `createStyleElementSubscription` retains existing `<style>` elements and updates only elements corresponding to modified reducer keys, reusing DOM nodes for unchanged keys. When plugins dispose, the subscription removes `<style>` elements associated with their keys to prevent orphaned elements.

## Quick start

EXAMPLE: Demonstrate how to create a cassiopeia instance, register a reducer plugin, provide a generator that scans for triple-dash properties, and inject resulting styles into the DOM.

## API

### createCassiopeia()

Creates a cassiopeia instance that coordinates dynamic CSS generation from Triple-dash CSS Custom Properties.

- `use(...plugins)` registers one or more plugins with the instance. Each plugin receives a context object with a `reducerFactories` proxy for registering reducer factories by key, plus `update()` / `updateSync()` methods to trigger processing of that plugin's registered keys, and `dispose()` to remove the plugin and clean up its keys.
- `update(generatorFactory?)` triggers an asynchronous update. When a generator factory is provided, it replaces the existing generator and discards the cached `[key, suffix]` pairs from previous runs. When omitted, the current generator and cache are preserved. Multiple async updates batch into a single run; when multiple calls provide generator factories, only the most recent factory is used.
- `updateSync(generatorFactory?)` triggers a synchronous update that executes to completion without yielding to the event loop. Generator factory behavior matches `update()`: supplying one replaces the generator and cache, omitting it preserves both.
- `subscribe(callback)` registers a callback invoked with `(keys, stylesheets)` after each run completes in browser environments. The callback receives the set of all registered reducer keys and an array of generated stylesheet objects. In a Node.js environment, subscriptions are not invoked; use `renderStyleSheets()` instead to generate stylesheets. Returns an unsubscribe function.
- `dispose()` removes all subscriptions and registered plugins, cleans up internal resources, and resets the state machine.

### createStyleElementSubscription(options)

Creates a subscription that injects generated stylesheets into the DOM as `<style>` elements. The subscription receives stylesheet output after each run and creates, updates, or removes style elements.

- `method` controls how style elements are updated: `overwrite` (default) modifies existing `<style>` elements in place by updating their text content. `insert-discard` inserts new `<style>` elements adjacent to existing ones, then removes the old elements.
- `namespace` is an optional string that qualifies the `cassiopeia-key` and `cassiopeia-index` attribute names. When multiple cassiopeia instances operate in the same document, different namespaces prevent collisions.
- `container` specifies where style elements are injected: `undefined` (default) injects into `document.head`; `Element` or `ShadowRoot` instance injects into the specified DOM node; CSS selector string injects into the selector's resolved element.

### renderStyleSheets(instance)

Generates stylesheets from a cassiopeia instance for server-side rendering. This function runs all registered reducers to completion synchronously and produces structured stylesheet data that can be inlined into HTML responses, enabling server-side CSS generation without browser DOM APIs. Returns an array of stylesheet objects when the instance has a configured generator. Each object contains:

- `key` identifies which reducer produced the stylesheet, matching the key used when registering the reducer factory.
- `index` provides a numeric position when a single reducer produces multiple stylesheets, starting from zero.
- `content` holds the generated CSS text that can be inserted into a `<style>` element or written to a file.
- `media` optionally specifies a media query when the reducer produces media-specific output.

Returns `undefined` when the instance has no generator configured, allowing applications to skip stylesheet rendering for incomplete configurations.

### createMultiplexer(factory, options[])

Creates a reducer factory that executes multiple instances of the same reducer with different configurations. The multiplexer runs all instances in parallel, processes the same input through each, and returns the combined outputs in the order specified by the options array.

**Parameters:**

- `factory` accepts a reducer factory function that takes a single configuration object and returns a reducer instance.
- `options` accepts an array of configuration objects, where each object becomes the constructor argument for one reducer instance.

The multiplexer creates one reducer instance per configuration object during initialization. When processing custom property suffixes, it broadcasts each suffix to all instances simultaneously. After all instances complete their processing, the multiplexer collects the output from each instance and returns them as an array. The output order matches the options array order. When cancelled, the multiplexer forwards the cancellation signal to all running instances.

The multiplexer executes identical processing logic with multiple configurations under a single reducer key. The primary scenario involves generating variant stylesheets—such as light mode, dark mode, and high-contrast themes—from a single set of custom properties.

### Type Guards

Type guards for distinguishing user data from termination control tokens in reducer pipelines and cached iterable sequences.

- `isReducerActive<U>(value)` filters termination control tokens from reducer inputs. Returns true when the value represents user data of type U, enabling processing to continue. Returns false when the value is a termination control token (CASSIOPEIA_CANCEL or CASSIOPEIA_COMPLETE). TypeScript narrows the value type to U when this guard returns true, removing control tokens from the union type.
- `isReducerTerminated<U>(value)` identifies termination control tokens in reducer inputs. Returns true when the value is a control token (CASSIOPEIA_CANCEL or CASSIOPEIA_COMPLETE), signaling that processing should halt. Returns false when the value is user data. TypeScript narrows the value type to the control token union when this guard returns true.
- `isIterableActive<U>(value)` filters CASSIOPEIA_CANCEL tokens from iterable inputs. Returns true when the value represents user data, enabling iteration to proceed. Returns false when the value is a cancellation token. TypeScript narrows the value type from the union `CassiopeiaCancel | U` to U when this guard returns true.
- `isIterableTerminated<U>(value)` identifies CASSIOPEIA_CANCEL tokens in iterable inputs. Returns true when the value is a cancellation token, signaling that iteration should stop. Returns false when the value is user data. TypeScript narrows the value type to CassiopeiaCancel when this guard returns true.
