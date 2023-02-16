import type { StyleSheet, Subscription } from 'cassiopeia'

export const browserSubscription: Subscription = (values: StyleSheet[]) => {
  values.forEach((value) => {
    let element =
      (document.querySelector(`head > [cassiopeia="${value.key}"]`) as
        | HTMLStyleElement
        | HTMLLinkElement
        | undefined) ?? undefined

    const deleteElement =
      element !== undefined && element.nodeName !== 'STYLE'
        ? element
        : undefined

    if (element === undefined) {
      element = document.createElement('style')
      element.setAttribute('cassiopeia', value.key)

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
