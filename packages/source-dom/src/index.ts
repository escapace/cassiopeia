import type { Cassiopeia } from 'cassiopeia'
import { REGEX } from 'cassiopeia'

const isSameDomain = (styleSheet: CSSStyleSheet): boolean => {
  if (styleSheet.href === null) {
    return true
  }

  return styleSheet.href.startsWith(window.location.origin)
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
    if (mutation.target.parentNode !== null && isStyle(mutation.target.parentNode)) {
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
  root: Document | ShadowRoot,
): Generator<[string, string, string], void, true | undefined> {
  const elements = root.querySelectorAll('*[style]')

  for (const element of elements) {
    const cssText = element.attributes.getNamedItem('style')?.value

    if (cssText !== undefined) {
      for (const match of cssText.matchAll(REGEX)) {
        const cancelled = yield match as unknown as [string, string, string]

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
            const cancelled = yield match as unknown as [string, string, string]

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

export const createSourceDOM = (options: Options = {}, cassiopeia: Cassiopeia) => {
  const root = options.root ?? document
  const createVariables = () => createVariableIterator(root)
  let isActive = false

  const mutationObserver = new MutationObserver((mutations) => {
    if (!isActive) {
      return
    }

    // TODO: timeout unused iterators
    if (mutations.some((mutation) => isValidMutation(mutation))) {
      void cassiopeia.update(createVariables)
    }
  })

  const start = () => {
    if (isActive) {
      return
    }

    isActive = true

    void cassiopeia.update(createVariables)

    mutationObserver.observe(root, {
      attributeFilter: ['style'],
      // characterData: true,
      // characterDataOldValue: false,
      attributeOldValue: false,
      attributes: true,
      childList: true,
      subtree: true,
    })
  }

  const stop = () => {
    if (!isActive) {
      return
    }

    isActive = false

    mutationObserver.disconnect()
  }

  return {
    isActive: () => isActive,
    start,
    stop,
  }
}
