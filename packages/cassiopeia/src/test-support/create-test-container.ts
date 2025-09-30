export interface TestContainer {
  cleanup: () => void
  element: Element | ShadowRoot
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
    cleanup: () => {
      if (hostElement !== undefined) {
        hostElement.remove()
      } else if (element instanceof Element) {
        element.remove()
      }
    },
    element,
  }
}

export function createTestSelector(): { cleanup: () => void; element: Element; selector: string } {
  const testId = `test-container-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const element = document.createElement('div')
  element.id = testId
  document.body.appendChild(element)

  return {
    cleanup: () => element.remove(),
    element,
    selector: `#${testId}`,
  }
}
