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

### createMultiplexer(factory, options\[])

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

# API

## function createCachedIterable [↗](src/create-cached-iterable.ts#L161-L244 'createCachedIterable')

Creates a cached iterable that wraps a factory-produced iterable with lazy evaluation and shared caching.

Values are cached as they are consumed from the source iterator, enabling multiple iterators to share the same underlying data without redundant factory calls or source re-evaluation. Each iterator follows a two-phase approach: first consuming cached values, then extending the cache by consuming from the source if the cache requires extension.

```typescript
export declare function createCachedIterable<T, TReturn = any>(
  factory: () => Iterable<T, TReturn, CassiopeiaCancel | undefined>,
): CachedIterable<T, TReturn>
```

### Type Parameters

| Parameter | Description                                           |
| --------- | ----------------------------------------------------- |
| `T`       | The type of values yielded by the iterable            |
| `TReturn` | The type of the return value from the source iterator |

### Parameters

| Parameter | Type                                                                                                                     | Description                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory` | <pre>() => Iterable\<T, TReturn, [CassiopeiaCancel](#type-cassiopeiacancel- 'type CassiopeiaCancel') \| undefined></pre> | Function that creates the source iterable. Called exactly once when the first cache extension is needed. Must return an iterable that accepts `TerminatingReducerCancel \| undefined` as input. |

### Returns

A [CachedIterable](#interface-cachediterable-) that yields the same values as the source but with caching behavior. Return value is `TReturn | undefined` since cancellation can prevent source completion.

### Remarks

**Iterator Behavior:** - Iterators first yield cached values in order - Multiple iterators cooperatively extend the shared cache as needed - Any iterator can extend the cache when requiring values beyond the current cached set - Iterators that have used a cleared source complete gracefully immediately

**Caching Behavior:** - Values are cached incrementally as consumed from the source - Multiple iterators share the same cache and cooperatively extend it - Cache preserves values consumed before errors or cancellation

**Lazy Evaluation:** - Factory is not called until an iterator needs to extend the cache - Source iterator creation is deferred until the first cache extension is required

**Cancellation Support:** The returned cached iterable supports two cancellation approaches:

1. **Iterator-based cancellation:** Pass `CASSIOPEIA_CANCEL` to any iterator's `next()` method 2. **Method-based cancellation:** Call the `CASSIOPEIA_CANCEL` method directly on the cached iterable

Both approaches have the same immediate effects: - `CASSIOPEIA_CANCEL` is forwarded to the current source iterator - Current source iterator is cleared, allowing active iterators to complete gracefully - New iterators created after cancellation immediately return done without creating sources

**Source Iterable Contract:** - Source iterables must check for `CASSIOPEIA_CANCEL` and return immediately - Source iterables must not perform additional work after receiving the cancel token - Source iterables must not yield additional values after cancellation - Iterables that violate this contract may result in unpredictable cache states

## function createStyleElementSubscription [↗](src/create-style-element-subscription.ts#L65-L141 'createStyleElementSubscription')

Creates a subscription function that dynamically manages `<style>` elements in the browser DOM. This function enables CSS injection and automatic cleanup for client-side applications by creating and maintaining style elements with qualified attributes for tracking.

```typescript
createStyleElementSubscription: (options?: StyleElementSubscriptionOptions) =>
  CassiopeiaSubscription
```

### Parameters

| Parameter | Type                                       | Description                                                   |
| --------- | ------------------------------------------ | ------------------------------------------------------------- |
| `options` | <pre>StyleElementSubscriptionOptions</pre> | Configuration for DOM update behavior and element namespacing |

### Returns

A subscription function that accepts CassiopeiaStyleSheets and updates the DOM accordingly

## function createTerminatingReducerFactoriesProxy [↗](src/create-terminating-reducers.ts#L135-L184 'createTerminatingReducerFactoriesProxy')

Creates a revocable proxy that intercepts factory modifications with lifecycle callbacks.

Wraps terminating reducer factories in a proxy that tracks property modifications, maintains a synchronized array of reducer keys, and provides controlled disposal. The proxy intercepts set and delete operations, calling corresponding lifecycle callbacks and updating the key array. Disposal revokes the proxy, clears all factory properties, and empties the key tracking array.

```typescript
export declare function createTerminatingReducerFactoriesProxy<T extends object = {}, U = unknown>(
  reducerFactories: TerminatingReducerFactories<T>,
  options: {
    onDelete: (key: keyof T) => void
    onDispose: (keys: Set<keyof T>) => U
    onSet: (key: keyof T) => void
  },
): {
  reducerFactories: TerminatingReducerFactories<T>
  reducerKeys: ReadonlySet<keyof T>
  dispose: () => U
}
```

### Type Parameters

| Parameter | Description                                                        |
| --------- | ------------------------------------------------------------------ |
| `T`       | Object type where each property value extends `TerminatingReducer` |
| `U`       | Return type of the disposal callback                               |

### Parameters

| Parameter          | Type                                                                                                                                  | Description                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `reducerFactories` | <pre>[TerminatingReducerFactories](#type-terminatingreducerfactories- 'type TerminatingReducerFactories')\<T></pre>                   | Reducer factory functions to wrap with proxy behavior |
| `options`          | <pre>{<br> onDelete: (key: keyof T) => void;<br> onDispose: (keys: Set\<keyof T>) => U;<br> onSet: (key: keyof T) => void;<br>}</pre> | Lifecycle callbacks and disposal handler              |

### Returns

Object containing the proxied factories, current keys array, and dispose method

## function createTerminatingReducers [↗](src/create-terminating-reducers.ts#L82-L118 'createTerminatingReducers')

Creates terminating reducers with implicit caching through getter replacement.

Sets up property getters for the specified keys that provide lazy initialization with implicit caching behavior. Upon first access, each getter invokes the corresponding factory function exactly once, eagerly primes the returned reducer instance, then replaces itself with a static property containing the primed reducer. This eliminates subsequent factory calls and getter overhead for the same property.

```typescript
export declare function createTerminatingReducers<T extends object>(
  reducerFactories: TerminatingReducerFactories<T>,
  keys: Iterable<keyof T>,
): TerminatingReducers<T>
```

### Type Parameters

| Parameter | Description                                                        |
| --------- | ------------------------------------------------------------------ |
| `T`       | Object type where each property value extends `TerminatingReducer` |

### Parameters

| Parameter          | Type                                                                                                                | Description                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `reducerFactories` | <pre>[TerminatingReducerFactories](#type-terminatingreducerfactories- 'type TerminatingReducerFactories')\<T></pre> | Record mapping each key to a factory function that returns a terminating reducer |
| `keys`             | <pre>Iterable\<keyof T></pre>                                                                                       | Iterable of keys from the factories record to set up as lazy properties          |

### Returns

Object with specified keys providing lazy initialization and implicit caching

Property enumeration behavior reflects the getter-to-value transformation: - Initially all properties are non-enumerable getters, excluded from `Object.keys/values/entries` - After first access, properties become enumerable static values included in enumeration - `Object.keys()` reflects only currently enumerable (accessed) properties - `Object.values()` and `Object.entries()` trigger initialization of accessed properties only

## function isIterableActive [↗](src/create-cached-iterable.ts#L18-L20 'isIterableActive')

Type guard that filters out CASSIOPEIA_CANCEL token from iterable inputs.

```typescript
export declare function isIterableActive<U = unknown>(value: CassiopeiaCancel | U): value is U
```

### Type Parameters

| Parameter | Description                 |
| --------- | --------------------------- |
| `U`       | The expected user data type |

### Parameters

| Parameter | Type                                                                                | Description                                           |
| --------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `value`   | <pre>[CassiopeiaCancel](#type-cassiopeiacancel- 'type CassiopeiaCancel') \| U</pre> | Input value that could be user data or a cancel token |

### Returns

`true` when the value is user data, `false` for cancel token

Checks whether an iterable input value is actual user data rather than a cancellation token. When this function returns `true`, TypeScript narrows the value type from `CassiopeiaCancel | U` to `U`, enabling type-safe processing of user data while excluding the `CASSIOPEIA_CANCEL` token.

## function isIterableTerminated [↗](src/create-cached-iterable.ts#L34-L38 'isIterableTerminated')

Type guard that identifies CASSIOPEIA_CANCEL token in iterable inputs.

```typescript
export declare function isIterableTerminated<U = unknown>(
  value: CassiopeiaCancel | U,
): value is CassiopeiaCancel
```

### Type Parameters

| Parameter | Description                 |
| --------- | --------------------------- |
| `U`       | The expected user data type |

### Parameters

| Parameter | Type                                                                                | Description                                           |
| --------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `value`   | <pre>[CassiopeiaCancel](#type-cassiopeiacancel- 'type CassiopeiaCancel') \| U</pre> | Input value that could be user data or a cancel token |

### Returns

`true` when the value is a cancel token, `false` for user data

Checks whether an iterable input value is a cancellation token rather than user data. When this function returns `true`, TypeScript narrows the value type from `CassiopeiaCancel | U` to `CassiopeiaCancel`, enabling type-safe handling of cancellation tokens.

## function isReducerActive [↗](src/create-terminating-reducers.ts#L198-L200 'isReducerActive')

Type guard that filters out termination control tokens from reducer inputs.

```typescript
export declare function isReducerActive<U = unknown>(value: TerminatingReducerNext<U>): value is U
```

### Type Parameters

| Parameter | Description                                         |
| --------- | --------------------------------------------------- |
| `U`       | The expected user data type (defaults to `unknown`) |

### Parameters

| Parameter | Type                                                                                                 | Description                                            |
| --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `value`   | <pre>[TerminatingReducerNext](#type-terminatingreducernext- 'type TerminatingReducerNext')\<U></pre> | Input value that could be user data or a control token |

### Returns

`true` when the value is user data of type `U`, `false` for control tokens

Checks whether a reducer input value is actual user data rather than a control token. When this function returns `true`, TypeScript narrows the value type from `TerminatingReducerNextInput<U>` to `U`, enabling type-safe processing of user data while excluding `CASSIOPEIA_CANCEL` and `CASSIOPEIA_COMPLETE` tokens.

## function isReducerTerminated [↗](src/create-terminating-reducers.ts#L214-L218 'isReducerTerminated')

Type guard that identifies termination control tokens in reducer inputs.

```typescript
export declare function isReducerTerminated<U = unknown>(
  value: TerminatingReducerNext<U>,
): value is CassiopeiaCancel | CassiopeiaComplete
```

### Type Parameters

| Parameter | Description                                         |
| --------- | --------------------------------------------------- |
| `U`       | The expected user data type (defaults to `unknown`) |

### Parameters

| Parameter | Type                                                                                                 | Description                                            |
| --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `value`   | <pre>[TerminatingReducerNext](#type-terminatingreducernext- 'type TerminatingReducerNext')\<U></pre> | Input value that could be user data or a control token |

### Returns

`true` when the value is a control token, `false` for user data

Checks whether a reducer input value is a termination control token rather than user data. When this function returns `true`, TypeScript narrows the value type from `TerminatingReducerNext<U>` to `TerminatingReducerCancel | TerminatingReducerComplete`, enabling type-safe handling of control tokens.

## function parseCustomPropertyName [↗](src/parse-custom-property-name.ts#L185-L203 'parseCustomPropertyName')

Parses Cassiopeia custom property names with `---KEY-SUFFIX` structure.

Pattern requirements: - Prefix: three literal hyphens `---` - KEY: identifier characters (letters, digits, underscore, non-ASCII) or CSS escapes; unescaped hyphens rejected - Separator: one literal hyphen `-` - SUFFIX: identifier characters or CSS escapes; unescaped hyphens allowed - Anchored to entire input; partial matches rejected - Case-sensitive

```typescript
export declare function parseCustomPropertyName(input: string): [string, string] | undefined
```

### Parameters

| Parameter | Type              | Description     |
| --------- | ----------------- | --------------- |
| `input`   | <pre>string</pre> | String to parse |

### Returns

Tuple `[key, suffix]` when input matches pattern, `undefined` otherwise

## function renderStyleSheets [↗](src/render-style-sheets.ts#L19-L40 'renderStyleSheets')

Extracts CSS stylesheets from a Cassiopeia instance for server-side rendering.

Runs the orchestrator to completion by consuming its iterator, processing all triple-dash custom properties (---key-suffix) through configured reducers. Each reducer transforms custom properties into stylesheet content with metadata including reducer key, position index, and optional attributes like media queries.

Returns undefined when no generator or reducers are available, allowing graceful handling of incomplete instance configurations during server-side rendering scenarios.

```typescript
renderStyleSheets: <T extends CassiopeiaInstance>(cassiopeia: T) =>
  CassiopeiaStyleSheets | undefined
```

### Parameters

| Parameter    | Type         | Description                                                                     |
| ------------ | ------------ | ------------------------------------------------------------------------------- |
| `cassiopeia` | <pre>T</pre> | Cassiopeia instance containing generator and reducers for stylesheet processing |

### Returns

Object containing stylesheet arrays and keys, or undefined if generator/reducers unavailable

## class CassiopeiaScope [↗](src/cassiopeia-scope.ts#L71-L197 'CassiopeiaScope')

Represents an isolated scope of triple-dash CSS custom property names. Tracks property names used within this scope and updates the parent's aggregate index. The update methods trigger CSS generation by passing the parent's generator to cassiopeia. The generator extracts key and suffix pairs from property names in the aggregate index and feeds them to the plugin system for CSS generation.

```typescript
export declare class CassiopeiaScope
```

### new CassiopeiaScope

Constructs a new instance of the `CassiopeiaScope` class

```typescript
constructor(parent: CassiopeiaScopes);
```

#### Parameters

| Parameter | Type                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| `parent`  | <pre>[CassiopeiaScopes](#class-cassiopeiascopes- 'class CassiopeiaScopes')</pre> |

### CassiopeiaScope.add

Adds a triple-dash CSS custom property name to this scope.

```typescript
add: (value: string) => boolean
```

### CassiopeiaScope.addMany

Adds multiple triple-dash CSS custom property names to this scope.

```typescript
addMany: (values: Iterable<string>) => boolean
```

### CassiopeiaScope.clear

Removes all triple-dash CSS custom property names from this scope.

```typescript
clear: () => boolean
```

### CassiopeiaScope.delete

Removes a triple-dash CSS custom property name from this scope.

```typescript
delete: (value: string) => boolean;
```

### CassiopeiaScope.deleteMany

Removes multiple triple-dash CSS custom property names from this scope.

```typescript
deleteMany: (values: Iterable<string>) => boolean
```

### CassiopeiaScope.dispose

Clears this scope, unregisters it from the parent, and nullifies references. The scope cannot be used after disposal.

```typescript
dispose: () => boolean
```

## class CassiopeiaScopes [↗](src/cassiopeia-scope.ts#L29-L62 'CassiopeiaScopes')

Manages multiple isolated scopes of triple-dash CSS custom property names. Maintains a deduplicated index of property names across all scopes. The update methods trigger CSS generation by passing a generator to cassiopeia. The generator extracts key and suffix pairs from property names in the aggregate index and feeds them to the plugin system for CSS generation.

```typescript
export declare class CassiopeiaScopes
```

### new CassiopeiaScopes

Constructs a new instance of the `CassiopeiaScopes` class

```typescript
constructor(cassiopeia: Cassiopeia);
```

#### Parameters

| Parameter    | Type                  |
| ------------ | --------------------- |
| `cassiopeia` | <pre>Cassiopeia</pre> |

### CassiopeiaScopes.createScope

Creates and registers a new isolated scope.

```typescript
createScope: () => CassiopeiaScope
```

### CassiopeiaScopes.dispose

Disposes all scopes and clears the aggregate index. Resets to the initial empty state.

```typescript
dispose: () => void;
```

## const CASSIOPEIA_CANCEL [↗](src/constants.ts#L123 'CASSIOPEIA_CANCEL')

Control token signaling a generator to cancel

```typescript
CASSIOPEIA_CANCEL: unique symbol
```

## const CASSIOPEIA_COMPLETE [↗](src/constants.ts#L119 'CASSIOPEIA_COMPLETE')

Control token signaling a generator to complete and return its final value.

```typescript
CASSIOPEIA_COMPLETE: unique symbol
```

## const CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX [↗](src/constants.ts#L60-L63 'CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX')

Unicode-aware regex matching Cassiopeia custom property names with escape sequence support. Performs syntactic validation for `---key-suffix` patterns.

Design philosophy: Permissive by design—accepts inputs that may be semantically invalid (e.g., out-of-range hex escapes). Final validation is delegated to the hand-rolled parser. The regex serves as a fast pre-filter before parser validation.

Identifier characters: letters (A-Z, a-z), digits (0-9), underscore (\_), and all non-ASCII characters (U+0080–U+10FFFF). Digits are allowed at the start of identifiers.

Escape sequences (matched literally, not decoded): - Hex escapes: `\2d ` (1-6 hex digits + optional space/tab) - Simple escapes: `\-` (backslash + any non-newline character)

Structural constraints: - Prefix: exactly three literal hyphens `---` - KEY segment: cannot contain unescaped hyphens (use `\2d ` or `\-` for hyphens in KEY) - Separator: exactly one literal hyphen `-` - SUFFIX segment: can contain unescaped hyphens after the first character

Requires the `u` flag for full Unicode support including supplementary planes. Uses the `i` flag for case-insensitive hex digit matching.

Capture groups: - `(1)`: KEY with literal escape sequences - `(2)`: SUFFIX with literal escape sequences

```typescript
CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX: RegExp
```

### Examples

```typescript
CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX.test('---color-primary') // true
CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX.test('---café-latté') // true
CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX.test('---my\\2d key-value') // true
CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX.test('--color-primary') // false (wrong prefix)
```

## const CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX [↗](src/constants.ts#L107-L110 'CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX')

Unicode-aware regex matching `var(---key-suffix)` patterns in CSS stylesheets with escape sequence support. Extracts the reducer key and suffix from Cassiopeia custom property references embedded in var() functions.

Design philosophy: Permissive by design—accepts inputs that may be semantically invalid (e.g., out-of-range hex escapes). Final validation is delegated to the hand-rolled parser. The regex serves as a fast pre-filter before parser validation.

Identifier characters: letters (A-Z, a-z), digits (0-9), underscore (\_), and all non-ASCII characters (U+0080–U+10FFFF). Digits are allowed at the start of identifiers.

Escape sequences (matched literally, not decoded): - Hex escapes: `\2d ` (1-6 hex digits + optional space/tab) - Simple escapes: `\-` (backslash + any non-newline character)

Structural constraints: - Prefix: `var(---` (var function with three literal hyphens) - KEY segment: cannot contain unescaped hyphens (use `\2d ` or `\-` for hyphens in KEY) - Separator: exactly one literal hyphen `-` - SUFFIX segment: can contain unescaped hyphens after the first character - Terminator: closing `)` or comma `,` (matches both `var(---key-suffix)` and `var(---key-suffix,)`

Global flag finds all occurrences in a stylesheet. Requires the `u` flag for full Unicode support including supplementary planes. Uses the `i` flag for case-insensitive hex digit matching.

Capture groups: - `(1)`: KEY with literal escape sequences - `(2)`: SUFFIX with literal escape sequences

```typescript
CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX: RegExp
```

### Examples

```typescript
'var(---color-primary)'.match(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
// Matches: ['var(---color-primary)', 'color', 'primary']

'var(---café-latté,'.match(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
// Matches: ['var(---café-latté,', 'café', 'latté']

'var(---my\2d key-value)'.match(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
// Matches: ['var(---my\2d key-value)', 'my\2d key', 'value']
```

## interface CachedIterable [↗](src/create-cached-iterable.ts#L77-L108 'CachedIterable')

Cached iterable with shared caching and external cancellation control.

```typescript
export interface CachedIterable<T, TReturn = unknown> extends Iterable<T, TReturn
  | undefined, CassiopeiaCancel | undefined>
```

### Type Parameters

| Parameter | Description                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `T`       | The type of values yielded by the iterable                                                                                                                                                                                                                                                                                                                                              |
| `TReturn` | The type of the return value from the source iterator<br><br>Combines the standard `Iterable` interface with external cancellation capabilities. Extends `Iterable<T, TReturn \| undefined, TerminatingReducerCancel \| undefined>` to provide iterator-based value consumption while adding a direct cancellation method that operates independently of any active iterator instances. |

### Remarks

**Iterator Behavior:** - Implements standard iterator protocol with `Symbol.iterator` method - Return type is `TReturn | undefined` since cancellation can prevent source completion - Accepts `TerminatingReducerCancel | undefined` as input to iterator `next()` calls

**Shared Caching:** - Multiple iterators created from the same cached iterable share a common value cache - Values are cached incrementally as consumed from the source - Cache persists across iterator instances and survives iterator completion

**External Cancellation:** - Provides direct cancellation control without requiring an active iterator - Cancellation clears current source iterator; new iterators created after cancellation return done immediately - Already-cached values remain accessible through existing iterators until they complete

### CachedIterable\[CASSIOPEIA_CANCEL]

Cancels the cached iterable and terminates any ongoing source iteration.

Provides external cancellation control without requiring an active iterator instance. Forwards `CASSIOPEIA_CANCEL` to the source iterator following the same contract as iterator-based cancellation through `next(CASSIOPEIA_CANCEL)`.

```typescript
[CASSIOPEIA_CANCEL]: () => void;
```

#### Remarks

**Cancellation Effects:** - Sends `CASSIOPEIA_CANCEL` to the current source before clearing it - Clears the current source iterator, forcing active iterators to complete gracefully immediately - New iterators created after cancellation immediately return done without extending cache or creating sources

**Idempotent Operation:** - Safe to call multiple times without side effects - Subsequent calls have no effect if no active source iterator exists - No error is thrown for redundant cancellation attempts

**Source Iterator Contract:** - Source iterator must handle `CASSIOPEIA_CANCEL` and return immediately - Source iterator must not perform additional work after receiving the cancel token - Source iterator must not yield additional values after cancellation - Contract violation may result in unpredictable cache states

## interface CassiopeiaPluginContext [↗](src/types.ts#L92-L103 'CassiopeiaPluginContext')

### CassiopeiaPluginContext.dispose

Cleanup function to remove plugin and trigger update

```typescript
dispose: () => Promise<void>
```

### CassiopeiaPluginContext.reducerFactories

Proxy for registering reducer factory functions with automatic change detection

```typescript
reducerFactories: CassiopeiaReducerFactories
```

### CassiopeiaPluginContext.reducerKeys

Read-only set of currently registered reducer keys

```typescript
reducerKeys: ReadonlySet<string>
```

### CassiopeiaPluginContext.update

Trigger async reducer-only update for this plugin's keys

```typescript
update: CassiopeiaReducerUpdate
```

### CassiopeiaPluginContext.updateSync

Trigger synchronous reducer-only update for this plugin's keys

```typescript
updateSync: CassiopeiaReducerUpdateSync
```

## type CassiopeiaCancel [↗](src/types.ts#L18 'CassiopeiaCancel')

Type alias for the cancel control token symbol.

```typescript
export type CassiopeiaCancel = typeof CASSIOPEIA_CANCEL
```

## type CassiopeiaComplete [↗](src/types.ts#L23 'CassiopeiaComplete')

Type alias for the complete control token symbol.

```typescript
export type CassiopeiaComplete = typeof CASSIOPEIA_COMPLETE
```

## type CassiopeiaGenerator [↗](src/types.ts#L50-L54 'CassiopeiaGenerator')

Generator that yields custom property key-suffix pairs. Processes CSS custom property references with triple-dash prefixes and extracts the key-suffix segments from the custom property identifier. The triple-dash pattern follows CSS custom property naming conventions but uses an extended prefix for key-based organization. For example, `var(---foo-bar)` yields the pair `['foo', 'bar']`.

```typescript
export type CassiopeiaGenerator = Generator<
  [string, string],
  undefined,
  CassiopeiaCancel | undefined
>
```

## type CassiopeiaGeneratorUpdate [↗](src/types.ts#L80-L82 'CassiopeiaGeneratorUpdate')

Update function that accepts optional generator factory for custom property source changes

```typescript
export type CassiopeiaGeneratorUpdate = (
  createGenerator?: () => CassiopeiaGenerator,
) => Promise<void>
```

## type CassiopeiaGeneratorUpdateSync [↗](src/types.ts#L85 'CassiopeiaGeneratorUpdateSync')

Update function that accepts optional generator factory for custom property source changes

```typescript
export type CassiopeiaGeneratorUpdateSync = (createGenerator?: () => CassiopeiaGenerator) => void
```

## type CassiopeiaOrchestrator [↗](src/types.ts#L41 'CassiopeiaOrchestrator')

Terminating reducer that coordinates stylesheet collection from multiple custom property processing reducers.

```typescript
export type CassiopeiaOrchestrator = TerminatingReducer<CassiopeiaStyleSheets, never>
```

## type CassiopeiaReducer [↗](src/types.ts#L61-L64 'CassiopeiaReducer')

Terminating reducer that processes custom property key-suffix strings and generates CSS stylesheets. Reduces triple-dash custom properties into stylesheet objects or arrays, with implementation-specific processing logic.

```typescript
export type CassiopeiaReducer = TerminatingReducer<
  CassiopeiaPartialStyleSheet | CassiopeiaPartialStyleSheet[],
  string
>
```

## type CassiopeiaReducerFactories [↗](src/types.ts#L70-L72 'CassiopeiaReducerFactories')

Factory functions for creating triple-dash custom property processing reducers with lazy initialization.

```typescript
export type CassiopeiaReducerFactories = TerminatingReducerFactories<
  Record<string, CassiopeiaReducer>
>
```

## type CassiopeiaReducers [↗](src/types.ts#L77 'CassiopeiaReducers')

Cached terminating reducers providing lazy access to triple-dash custom property processing instances.

```typescript
export type CassiopeiaReducers = TerminatingReducers<Record<string, CassiopeiaReducer>>
```

## type CassiopeiaReducerUpdate [↗](src/types.ts#L88 'CassiopeiaReducerUpdate')

Update function that accepts optional reducer keys for targeted plugin updates

```typescript
export type CassiopeiaReducerUpdate = (keys?: Iterable<string>) => Promise<void>
```

## type CassiopeiaReducerUpdateSync [↗](src/types.ts#L90 'CassiopeiaReducerUpdateSync')

Update function that accepts optional reducer keys for targeted plugin updates

```typescript
export type CassiopeiaReducerUpdateSync = (keys?: Iterable<string>) => void
```

## type TerminatingReducer [↗](src/create-terminating-reducers.ts#L30-L34 'TerminatingReducer')

Generator type representing a synchronous terminating reducer.

```typescript
export type TerminatingReducer<
  GeneratorReturn = unknown,
  GeneratorNext = unknown,
  T = undefined,
> = Generator<T, TerminatingReducerReturn<GeneratorReturn>, TerminatingReducerNext<GeneratorNext>>
```

### Type Parameters

| Parameter         | Description                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GeneratorReturn` | The type of value returned when the reducer completes normally                                                                                                                                                                                                                                                                                                                 |
| `GeneratorNext`   | The type of data values accepted as input during processing<br><br>Terminating reducers are synchronous generators that implement a controlled processing pattern where they yield nothing during execution, accept typed input through `.next()` including control tokens, and return either a final computed value or `undefined` when processing completes or is cancelled. |

## type TerminatingReducerFactories [↗](src/create-terminating-reducers.ts#L45-L47 'TerminatingReducerFactories')

Input type for `createTerminatingReducers()` defining factory functions for each reducer key.

```typescript
export type TerminatingReducerFactories<T extends object = {}> = {
  [K in keyof T]: () => T[K] extends TerminatingReducer ? T[K] : never
}
```

### Type Parameters

| Parameter | Description                                                                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `T`       | Object type where each property value extends `TerminatingReducer`<br><br>Maps each property key to a factory function that returns a `TerminatingReducer` for that key. Factory functions are invoked exactly once per property upon first access, after which the getter is replaced with the static reducer instance for direct access. |

## type TerminatingReducerNext [↗](src/create-terminating-reducers.ts#L9-L12 'TerminatingReducerNext')

Union type representing all possible input values for a terminating reducer.

```typescript
export type TerminatingReducerNext<GeneratorNext = unknown> =
  | CassiopeiaCancel
  | CassiopeiaComplete
  | GeneratorNext
```

## type TerminatingReducerReturn [↗](src/create-terminating-reducers.ts#L17 'TerminatingReducerReturn')

Union type representing all possible return values for a terminating reducer.

```typescript
export type TerminatingReducerReturn<GeneratorReturn = unknown> = GeneratorReturn | undefined
```

## type TerminatingReducers [↗](src/create-terminating-reducers.ts#L58-L60 'TerminatingReducers')

Return type from `createTerminatingReducers()` with implicit caching through getter replacement.

```typescript
export type TerminatingReducers<T extends object = {}> = {
  readonly [K in keyof T]: T[K] extends TerminatingReducer ? T[K] : never
}
```

### Type Parameters

| Parameter | Description                                                                                                                                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `T`       | Object type where each property value extends `TerminatingReducer`<br><br>Properties provide lazy initialization with implicit caching behavior: first access triggers factory invocation and getter replacement with the static value, eliminating subsequent factory calls for the same property. |
