import { assert } from 'vitest'

export interface StyleElementInfo {
  content: string
  element: HTMLStyleElement
  index: number
  key: string
  media?: string
}

export function getStyleElements(
  container: Element | ShadowRoot,
  namespace?: string,
): StyleElementInfo[] {
  const qualifierKey = namespace !== undefined ? `cassiopeia-key-${namespace}` : 'cassiopeia-key'
  const qualifierIndex =
    namespace !== undefined ? `cassiopeia-index-${namespace}` : 'cassiopeia-index'

  return Array.from(container.querySelectorAll(`style[${qualifierKey}][${qualifierIndex}]`)).map(
    (element) => {
      const styleElement = element as HTMLStyleElement
      const key = styleElement.getAttribute(qualifierKey)
      const indexString = styleElement.getAttribute(qualifierIndex)
      const media = styleElement.getAttribute('media')

      if (key === null || indexString === null) {
        throw new Error('Style element is missing required attributes')
      }

      return {
        content: styleElement.innerHTML,
        element: styleElement,
        index: parseInt(indexString),
        key,
        media: media ?? undefined,
      }
    },
  )
}

export function assertStyleElementExists(
  container: Element | ShadowRoot,
  key: string,
  index: number,
  expectedContent: string,
  namespace?: string,
) {
  const elements = getStyleElements(container, namespace)
  const element = elements.find(
    (elementInfo) => elementInfo.key === key && elementInfo.index === index,
  )

  assert.isDefined(element, `Style element with key="${key}" index=${index} should exist`)
  assert.equal(element.content, expectedContent, 'Style element content should match')
}

export function assertStyleElementCount(
  container: Element | ShadowRoot,
  expectedCount: number,
  namespace?: string,
) {
  const elements = getStyleElements(container, namespace)
  assert.equal(
    elements.length,
    expectedCount,
    `Should have exactly ${expectedCount} style elements`,
  )
}

export function assertStyleElementNotExists(
  container: Element | ShadowRoot,
  key: string,
  index: number,
  namespace?: string,
) {
  const elements = getStyleElements(container, namespace)
  const element = elements.find(
    (elementInfo) => elementInfo.key === key && elementInfo.index === index,
  )

  assert.isUndefined(element, `Style element with key="${key}" index=${index} should not exist`)
}

export function assertStyleElementHasMedia(
  container: Element | ShadowRoot,
  key: string,
  index: number,
  expectedMedia: string,
  namespace?: string,
) {
  const elements = getStyleElements(container, namespace)
  const element = elements.find(
    (elementInfo) => elementInfo.key === key && elementInfo.index === index,
  )

  assert.isDefined(element, `Style element with key="${key}" index=${index} should exist`)
  assert.equal(element.media, expectedMedia, 'Style element media attribute should match')
}

export function assertStyleElementHasNoMedia(
  container: Element | ShadowRoot,
  key: string,
  index: number,
  namespace?: string,
) {
  const elements = getStyleElements(container, namespace)
  const element = elements.find(
    (elementInfo) => elementInfo.key === key && elementInfo.index === index,
  )

  assert.isDefined(element, `Style element with key="${key}" index=${index} should exist`)
  assert.isUndefined(element.media, 'Style element should not have media attribute')
}
