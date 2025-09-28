/**
 * Normalizes container input to a resolved DOM element.
 * Provides flexible container targeting with graceful error handling for style injection scenarios.
 *
 * Supports multiple input types for maximum flexibility:
 * - Direct element references for performance
 * - ShadowRoot targeting for Web Component style isolation
 * - String selectors for dynamic container resolution
 * - Undefined input with fallback to document.head for global styles
 *
 * @param container - Container specification to resolve
 * @returns Resolved container element for style injection
 * @throws Error when string selector fails to resolve to an element
 */
export function normalizeContainer(
  container: string | Element | ShadowRoot | undefined,
): Element | ShadowRoot {
  if (container === undefined) {
    return document.head
  }

  if (typeof container === 'string') {
    const resolved = document.querySelector(container)
    if (resolved === null) {
      throw new Error(
        `Failed to resolve container selector "${container}" - no matching element found`,
      )
    }
    return resolved
  }

  return container
}
