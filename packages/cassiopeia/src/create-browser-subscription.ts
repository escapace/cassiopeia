import type { CassiopeiaSubscription } from './index'

export const createBrowserSubscription = (options?: {
  method: 'insert-discard' | 'overwrite'
  id?: string
}): CassiopeiaSubscription => {
  const qualifierKey =
    typeof options?.id === 'string' ? `cassiopeia-key-${options.id}` : `cassiopeia-key`
  const qualifierIndex =
    typeof options?.id === 'string' ? `cassiopeia-index-${options.id}` : `cassiopeia-index`
  const method = options?.method ?? 'overwrite'

  return ({ keys, values }) => {
    const elements = Array.from(document.querySelectorAll(`head > [${qualifierKey}]`)).map(
      (element) => ({
        element,
        index: parseInt(element.getAttribute(qualifierIndex)!),
        key: element.getAttribute(qualifierKey)!,
      }),
    )

    values.forEach(({ content, index, key, media }) => {
      const index_ = elements.findIndex((value) => value.key === key && value.index === index)

      if (index_ !== -1 && method === 'overwrite') {
        const { element } = elements.splice(index_, 1)[0]

        if (typeof media === 'string') {
          element.setAttribute('media', media)
        } else if (element.hasAttribute('media')) {
          element.removeAttribute('media')
        }

        element.innerHTML = content
      } else {
        const element = document.createElement('style')
        element.setAttribute(qualifierKey, key)

        if (typeof media === 'string') {
          element.setAttribute('media', media)
        }

        element.innerHTML = content

        if (index_ === -1) {
          document.head.insertBefore(element, null)
        } else {
          elements[index_].element.insertAdjacentElement('afterend', element)
        }
      }
    })

    for (const { element, key } of elements) {
      if (!keys.includes(key)) {
        element.remove()
      }
    }
  }
}
