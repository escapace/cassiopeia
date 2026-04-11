import type { CassiopeiaSubscription } from './index'
import { normalizeContainer } from './normalize-container'

/**
 * Configuration options for style element subscription behavior.
 */
export interface StyleElementSubscriptionOptions {
  /**
   * Update strategy for existing style elements.
   *
   * - `overwrite`: Modifies existing elements in-place, preserving element identity and DOM position.
   *   Preferred for performance as it avoids element recreation and DOM reflow.
   * - `insert-discard`: Replaces elements entirely by creating new ones at the same position.
   *   Use when complete element replacement is required for compatibility or debugging.
   *
   * @defaultValue `'overwrite'`
   */
  method?: 'insert-discard' | 'overwrite'

  /**
   * Optional namespace identifier for isolating style element groups.
   * When provided, creates qualified attributes like `cassiopeia-key-theme` instead of `cassiopeia-key`.
   */
  namespace?: string

  /**
   * Container element for style injection. Supports flexible targeting for different DOM contexts.
   *
   * - `Element`: Direct element reference where styles will be injected
   * - `ShadowRoot`: Shadow DOM root for Web Component style isolation
   * - `string`: CSS selector that resolves to a container element
   * - `undefined`: Defaults to `document.head` for global stylesheet management
   *
   * @defaultValue `document.head`
   */
  container?: string | Element | ShadowRoot
}

/**
 * Updates media query attribute on style elements to control CSS application scope.
 * Removes existing media attribute when no media query is specified to ensure
 * unconditional CSS application.
 *
 * @param element - Style element to modify
 * @param media - Media query string or undefined to remove media attribute
 */
const updateMediaAttribute = (element: HTMLStyleElement, media?: string) => {
  if (typeof media === 'string') {
    if (element.getAttribute('media') !== media) {
      element.setAttribute('media', media)
    }
  } else if (element.hasAttribute('media')) {
    element.removeAttribute('media')
  }
}

/**
 * Creates a subscription function that dynamically manages `<style>` elements in the browser DOM.
 * This function enables CSS injection and automatic cleanup for client-side applications by
 * creating and maintaining style elements with qualified attributes for tracking.
 *
 * @param options - Configuration for DOM update behavior and element namespacing
 *
 * @returns A subscription function that accepts CassiopeiaStyleSheets and updates the DOM accordingly
 */
export const createStyleElementSubscription = (
  options?: StyleElementSubscriptionOptions,
): CassiopeiaSubscription => {
  const qualifierKey =
    typeof options?.namespace === 'string'
      ? `cassiopeia-key-${options.namespace}`
      : `cassiopeia-key`
  const qualifierIndex =
    typeof options?.namespace === 'string'
      ? `cassiopeia-index-${options.namespace}`
      : `cassiopeia-index`
  const method = options?.method ?? 'overwrite'

  const container = normalizeContainer(options?.container)

  return (keys, values) => {
    const elements = new Map<string, HTMLStyleElement>()
    const keysWithValues = new Set()

    // Phase 1: Discover existing elements to avoid redundant DOM queries later
    for (const element of container.querySelectorAll(`style[${qualifierKey}][${qualifierIndex}]`)) {
      const index = parseInt(element.getAttribute(qualifierIndex)!)
      const key = element.getAttribute(qualifierKey)!

      if (keys.has(key)) {
        // Track with composite key to handle multiple indices per plugin
        const compositeKey = `${key}:${index}`
        elements.set(compositeKey, element as HTMLStyleElement)
      } else {
        // Remove immediately since this key is no longer needed
        element.remove()
      }
    }

    // Phase 2: Process new values, reusing existing elements when beneficial
    for (const { content, index, key, media } of values) {
      const compositeKey = `${key}:${index}`
      const existingElement = elements.get(compositeKey)
      const hasExistingElement = existingElement !== undefined

      if (hasExistingElement && method === 'overwrite') {
        // Modify in-place to preserve element position
        updateMediaAttribute(existingElement, media)
        if (existingElement.textContent !== content) {
          existingElement.textContent = content
        }
        elements.delete(compositeKey)
      } else {
        // Create new element for insert-discard method or when no existing element
        const element = document.createElement('style')
        element.setAttribute(qualifierKey, key)
        element.setAttribute(qualifierIndex, index.toString())
        if (typeof media === 'string') element.setAttribute('media', media)
        element.textContent = content

        if (hasExistingElement) {
          // Replace existing element while maintaining document order
          existingElement.insertAdjacentElement('afterend', element)
          existingElement.remove()
          elements.delete(compositeKey)
        } else {
          container.insertBefore(element, null)
        }
      }

      keysWithValues.add(key)
    }

    // Phase 3: Clean up orphaned elements from keys that received new values
    for (const [compositeKey, element] of elements) {
      const key = compositeKey.split(':')[0]

      if (keysWithValues.has(key)) {
        // Remove stale elements to prevent CSS conflicts
        element.remove()
      }
    }
  }
}
