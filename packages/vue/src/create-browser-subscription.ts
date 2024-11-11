import type { StyleSheet, Subscription } from 'cassiopeia'

export const createBrowserSubscription = (options?: {
  method: 'insert-discard' | 'overwrite'
  id?: string
  timeout?: number
}): Subscription => {
  const identifier = typeof options?.id === 'string' ? `cassiopeia-${options.id}` : `cassiopeia`
  const method = options?.method ?? 'overwrite'
  const timeout = options?.timeout ?? 100
  const defer =
    typeof requestIdleCallback === 'undefined'
      ? (value: () => unknown) => void setTimeout(value, timeout)
      : (value: () => unknown) => void requestIdleCallback(value, { timeout })

  return (styles: StyleSheet[]) => {
    const current = Array.from(document.querySelectorAll(`head > [${identifier}]`)).map(
      (element) => ({
        element,
        key: element.getAttribute(identifier),
      }),
    )

    styles.forEach((style) => {
      const key = `${style.name}-${style.key}`

      const index = current.findIndex((value) => value.key === key)

      if (index !== -1 && method === 'overwrite') {
        const { element } = current.splice(index, 1)[0]

        if (typeof style.media === 'string') {
          element.setAttribute('media', style.media)
        } else if (element.hasAttribute('media')) {
          element.removeAttribute('media')
        }

        element.innerHTML = style.content
      } else {
        const element = document.createElement('style')
        element.setAttribute(identifier, key)

        if (typeof style.media === 'string') {
          element.setAttribute('media', style.media)
        }

        element.innerHTML = style.content

        if (index === -1) {
          document.head.insertBefore(element, null)
        } else {
          current[index].element.insertAdjacentElement('afterend', element)
        }
      }
    })

    if (current.length > 0) {
      defer(() => {
        current.forEach(({ element }) => element.remove())
      })
    }
  }
}
