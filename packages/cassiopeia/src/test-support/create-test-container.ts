export interface TestContainer {
  element: Element | ShadowRoot
  cleanup: () => void
}

export function createTestContainer(type: 'div' | 'shadow' = 'div'): TestContainer {
  let element: Element | ShadowRoot
  let hostElement: Element | undefined

  if (type === 'shadow') {
    hostElement = document.createElement('div')
    document.body.appendChild(hostElement)
    element = hostElement.attachShadow({ mode: 'open' })
  } else {
    element = document.createElement('div')
    document.body.appendChild(element)
  }

  return {
    element,
    cleanup: () => {
      if (hostElement !== undefined) {
        hostElement.remove()
      } else if (element instanceof Element) {
        element.remove()
      }
    },
  }
}

export function createTestSelector(): { element: Element; selector: string; cleanup: () => void } {
  const testId = `test-container-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const element = document.createElement('div')
  element.id = testId
  document.body.appendChild(element)

  return {
    element,
    selector: `#${testId}`,
    cleanup: () => element.remove(),
  }
}
