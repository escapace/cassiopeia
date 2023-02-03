import { REGEX, SOURCE, TypeState } from 'cassiopeia'
import type { Source, Store, Variables } from 'cassiopeia'

const isSameDomain = (styleSheet: CSSStyleSheet): boolean => {
  if (styleSheet.href === null) {
    return true
  }

  return styleSheet.href.indexOf(window.location.origin) === 0
}

const isStylesheet = (node: Node) =>
  node.nodeName.toLowerCase() === 'link' &&
  ((node as Element)?.getAttribute('rel') ?? '').includes('stylesheet')

const isStyle = (node: Node) => node.nodeName.toLowerCase() === 'style'

const isSupportedCSSRule = (rule: CSSRule): boolean => {
  const name = rule.constructor.name

  return (
    name === 'CSSStyleRule' ||
    name === 'CSSMediaRule' ||
    name === 'CSSPageRule' ||
    name === 'CSSKeyframesRule' ||
    name === 'CSSSupportsRule'
  )
}

const isValidMutation = (mutation: MutationRecord) => {
  // TODO: check this
  // if (mutation.target === store.styleElement) {
  //   return false
  // }

  if (mutation.type === 'attributes') {
    if (mutation.target.nodeType === 1) {
      // console.log((mutation.target as HTMLElement).attributes.getNamedItem('style')?.value)
      // console.log((mutation.target as HTMLElement)?.style?.cssText)
    }

    return true
  } else if (mutation.type === 'characterData') {
    if (
      mutation.target.parentNode !== null &&
      isStyle(mutation.target.parentNode)
    ) {
      return true
    }
  } else if (mutation.type === 'childList') {
    for (const node of mutation.addedNodes) {
      if (isStylesheet(node)) {
        return true
      }

      if (isStyle(node)) {
        return true
      }
    }

    for (const node of mutation.removedNodes) {
      if (isStylesheet(node)) {
        return true
      }

      if (isStyle(node)) {
        return true
      }
    }
  }

  return false
}

function* createVariableIterator(
  root: Document | ShadowRoot
): Generator<[string, string, string], void, true | undefined> {
  const elements = root.querySelectorAll('*[style]')

  for (const element of elements) {
    const cssText = element.attributes.getNamedItem('style')?.value

    if (cssText !== undefined) {
      for (const match of cssText.matchAll(REGEX)) {
        const cancelled = yield match as [string, string, string]

        if (cancelled) {
          return
        }
      }
    }
  }

  for (const cssStyleSheet of root.styleSheets) {
    if (
      cssStyleSheet.ownerNode instanceof Element &&
      cssStyleSheet.ownerNode.getAttribute('cassiopeia') !== null
    ) {
      continue
    }

    if (isSameDomain(cssStyleSheet)) {
      for (const cssRule of cssStyleSheet.cssRules) {
        if (isSupportedCSSRule(cssRule)) {
          for (const match of cssRule.cssText.matchAll(REGEX)) {
            const cancelled = yield match as [string, string, string]

            if (cancelled) {
              return
            }
          }
        }
      }
    }
  }
}

interface Options {
  root?: Document | ShadowRoot
}

export const createSourceDOM =
  (options: Options = {}): Source =>
  (store: Store, update: (createVariables: () => Variables) => void) => {
    const root = options.root ?? document
    const createVariables = () => createVariableIterator(root)

    const mutationObserver = new MutationObserver((mutations) => {
      if (store.state !== TypeState.Active) {
        return
      }

      // TODO: timeout unused iterators
      if (mutations.some((mutation) => isValidMutation(mutation))) {
        update(createVariables)
      }
    })

    const start = () => {
      if (store.state !== TypeState.Activating) return

      update(createVariables)

      mutationObserver.observe(root, {
        attributes: true,
        // characterData: true,
        // characterDataOldValue: false,
        attributeOldValue: false,
        attributeFilter: ['style'],
        subtree: true,
        childList: true
      })
    }

    return {
      [SOURCE]: {
        start,
        stop: () => mutationObserver.disconnect()
      }
    }
  }
