import type { StyleSheet, Subscription } from 'cassiopeia'

// TODO: hydration
// On ssr it will hydrate as cassiopeia=color-0 cassiopeia=color-1
// On browser it will hydrate as color
export const browserSubscription: Subscription = (values: StyleSheet[]) => {
  values.forEach((value) => {
    const key = `${value.name}-${value.key}`

    let element =
      (document.querySelector(`head > [cassiopeia="${key}"]`) as
        | HTMLStyleElement
        | HTMLLinkElement
        | undefined) ?? undefined

    const deleteElement =
      element !== undefined && element.nodeName !== 'STYLE'
        ? element
        : undefined

    if (element === undefined) {
      element = document.createElement('style')
      element.setAttribute('cassiopeia', key)

      if (value.media === 'string') {
        element.setAttribute('media', value.media)
      }

      document.head.insertBefore(element, null)
    }

    if (deleteElement !== undefined) {
      deleteElement.remove()
    }

    element.innerHTML = value.content
  })
}
