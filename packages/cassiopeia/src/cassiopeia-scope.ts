import { CASSIOPEIA_CANCEL } from './constants'
import { parseCustomPropertyName } from './parse-custom-property-name'
import type { Cassiopeia, CassiopeiaGenerator } from './types'

function* createGenerator(this: CassiopeiaScopes): CassiopeiaGenerator {
  for (const string of Object.keys(this.index)) {
    const match = parseCustomPropertyName(string)

    if (match === undefined) {
      continue
    }

    const cancelled = yield match

    if (cancelled === CASSIOPEIA_CANCEL) {
      return
    }
  }
}

/**
 * Manages multiple isolated scopes of triple-dash CSS custom property names.
 * Maintains a deduplicated index of property names across all scopes.
 * The update methods trigger CSS generation by passing a generator to cassiopeia.
 * The generator extracts key and suffix pairs from property names in the aggregate index
 * and feeds them to the plugin system for CSS generation.
 */
export class CassiopeiaScopes {
  private readonly cassiopeia: Cassiopeia
  private readonly createGenerator = createGenerator.bind(this)
  public index: Record<string, number>
  public subsets: Set<CassiopeiaScope>

  constructor(cassiopeia: Cassiopeia) {
    this.index = Object.create(null) as Record<string, number>
    this.subsets = new Set()
    this.cassiopeia = cassiopeia
  }

  update = () => this.cassiopeia.update(this.createGenerator)
  updateSync = () => this.cassiopeia.updateSync(this.createGenerator)

  /**
   * Creates and registers a new isolated scope.
   *
   * @returns A new scope for managing triple-dash CSS custom property names
   */
  createScope = (): CassiopeiaScope => new CassiopeiaScope(this)

  /**
   * Disposes all scopes and clears the aggregate index.
   * Resets to the initial empty state.
   */
  dispose = (): void => {
    for (const subset of this.subsets) {
      subset.dispose()
    }
    this.subsets.clear()
    this.index = Object.create(null) as Record<string, number>
  }
}

/**
 * Represents an isolated scope of triple-dash CSS custom property names.
 * Tracks property names used within this scope and updates the parent's aggregate index.
 * The update methods trigger CSS generation by passing the parent's generator to cassiopeia.
 * The generator extracts key and suffix pairs from property names in the aggregate index
 * and feeds them to the plugin system for CSS generation.
 */
export class CassiopeiaScope {
  private store: Set<string>
  private parent?: CassiopeiaScopes

  public update: () => Promise<void>
  public updateSync: () => void

  constructor(parent: CassiopeiaScopes) {
    this.store = new Set()
    this.parent = parent
    parent.subsets.add(this)

    this.update = parent.update
    this.updateSync = parent.updateSync
  }

  /**
   * Adds a triple-dash CSS custom property name to this scope.
   *
   * @param value - The CSS custom property name
   * @returns True when the property name enters the aggregate index, false otherwise
   */
  add = (value: string): boolean => {
    if (this.store.has(value)) {
      return false
    }

    this.store.add(value)

    const index = this.parent!.index
    const change = index[value] === undefined
    index[value] = change ? 1 : index[value] + 1

    return change
  }

  /**
   * Removes a triple-dash CSS custom property name from this scope.
   *
   * @param value - The CSS custom property name
   * @returns True when the property name exits the aggregate index, false otherwise
   */
  delete = (value: string): boolean => {
    if (!this.store.delete(value)) {
      return false
    }

    const index = this.parent!.index
    const count = index[value] - 1
    const change = count === 0

    if (change) {
      Reflect.deleteProperty(index, value)
    } else {
      index[value] = count
    }

    return change
  }

  /**
   * Adds multiple triple-dash CSS custom property names to this scope.
   *
   * @param values - CSS custom property names to add
   * @returns True when at least one property name enters the aggregate index, false otherwise
   */
  addMany = (values: Iterable<string>): boolean => {
    let changed = false

    for (const value of values) {
      changed = this.add(value) || changed
    }

    return changed
  }

  /**
   * Removes multiple triple-dash CSS custom property names from this scope.
   *
   * @param values - CSS custom property names to remove
   * @returns True when at least one property name exits the aggregate index, false otherwise
   */
  deleteMany = (values: Iterable<string>): boolean => {
    let changed = false

    for (const value of values) {
      changed = this.delete(value) || changed
    }

    return changed
  }

  /**
   * Removes all triple-dash CSS custom property names from this scope.
   *
   * @returns True when at least one property name exits the aggregate index, false otherwise
   */
  clear = (): boolean => {
    const values = Array.from(this.store)
    let changed = false

    for (const value of values) {
      changed = this.delete(value) || changed
    }

    return changed
  }

  /**
   * Clears this scope, unregisters it from the parent, and nullifies references.
   * The scope cannot be used after disposal.
   *
   * @returns True when at least one property name exited the aggregate index during disposal, false otherwise
   */
  dispose = (): boolean => {
    if (this.parent === undefined) {
      return false
    }

    const value = this.clear()
    this.parent.subsets.delete(this)
    this.store = undefined!
    this.parent = undefined!

    return value
  }
}
