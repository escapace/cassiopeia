import type { StyleSheet, Subscription } from 'cassiopeia'

export const browserSubscription: Subscription = (styles: StyleSheet[]) => {
  const current = Array.from(
    document.querySelectorAll(`head > [cassiopeia]`)
  ).map((element) => ({
    element,
    key: element.getAttribute('cassiopeia')
  }))

  styles.forEach((style) => {
    const key = `${style.name}-${style.key}`

    const index = current.findIndex((value) => value.key === key)

    if (index === -1) {
      const element = document.createElement('style')
      element.setAttribute('cassiopeia', key)

      if (typeof style.media === 'string') {
        element.setAttribute('media', style.media)
      }

      element.innerHTML = style.content

      document.head.insertBefore(element, null)
    } else {
      const { element } = current.splice(index, 1)[0]

      if (typeof style.media === 'string') {
        element.setAttribute('media', style.media)
      } else if (element.hasAttribute('media')) {
        element.removeAttribute('media')
      }

      element.innerHTML = style.content
    }
  })

  current.forEach(({ element }) => element.remove())
}
