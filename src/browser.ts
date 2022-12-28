import { ID, REGEX, STORE } from './constants'
import {
  Cassiopeia as ICassiopeia,
  Deregister,
  Iterator,
  Iterators,
  Matcher,
  Options as IOptions,
  Plugin,
  Register,
  Store as IStore,
  TypeState
} from './types'
import { createMatcher } from './utilities/create-matcher'

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

// TODO: cache this
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

const isValidMutation = (mutation: MutationRecord, store: Store) => {
  if (mutation.target === store.styleElement) {
    return false
  }

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

interface Store extends IStore {
  id: string
  iterators: Iterators
  matcher?: Matcher
  root: Document | ShadowRoot
  state: TypeState
  styleElement?: HTMLStyleElement
  update: TypeUpdate
}

const enum TypeUpdate {
  Locked,
  None,
  Scheduled,
  Running
}

function schedulerTask(matcher: Matcher, store: Store): void {
  if (matcher === store.matcher && store.update === TypeUpdate.Running) {
    const cursor = matcher.next()

    if (cursor.done !== true) {
      setTimeout(() => schedulerTask(matcher, store))
      return
    }

    if (cursor.value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      store.styleElement!.textContent = cursor.value
    }

    store.update = TypeUpdate.None
    store.matcher = undefined
  } else {
    /* matcher has been updated or the state has changed, garbage collect */
    matcher.next(true)
  }
}

function schedulerFrame(store: Store) {
  if (store.update === TypeUpdate.Scheduled) {
    const matcher = (store.matcher = createMatcher(
      createVariableIterator(store.root),
      store.iterators
    ))
    store.update = TypeUpdate.Running

    schedulerTask(matcher, store)
  }
}

function createScheduler(store: Store) {
  const boundSchedulerFrame = schedulerFrame.bind(null, store)

  const lock = (lock: boolean) => {
    store.matcher = undefined

    store.update = lock ? TypeUpdate.Locked : TypeUpdate.None
  }

  const update = () => {
    if (store.update === TypeUpdate.Running) {
      store.matcher = undefined
      store.update = TypeUpdate.None
    }

    if (store.update === TypeUpdate.None) {
      store.update = TypeUpdate.Scheduled
      requestAnimationFrame(boundSchedulerFrame)
    }
  }

  return { update, lock }
}

const createMutationObserver = (store: Store, update: () => void) => {
  const mutationObserver = new MutationObserver((mutations) => {
    if (store.state !== TypeState.Active) {
      return
    }

    if (mutations.some((mutation) => isValidMutation(mutation, store))) {
      update()
    }
  })

  const start = () => {
    if (store.state === TypeState.Active) return

    mutationObserver.observe(store.root, {
      attributes: true,
      // characterData: true,
      // characterDataOldValue: false,
      attributeOldValue: false,
      attributeFilter: ['style'],
      subtree: true,
      childList: true
    })

    store.state = TypeState.Active
  }

  return { start, stop: () => mutationObserver.disconnect() }
}

const isDocument = (value: Document | ShadowRoot): value is Document =>
  value.nodeType === 9

const createStyleElement = (
  id: string,
  root: Document | ShadowRoot
): HTMLStyleElement => {
  let styleElement =
    (root.querySelector(`style[cassiopeia=${id}]`) as
      | HTMLStyleElement
      | undefined) ?? undefined

  if (styleElement === undefined) {
    styleElement = document.createElement('style')
    styleElement.setAttribute('cassiopeia', id)

    if (isDocument(root)) {
      root.head.insertBefore(styleElement, null)
    } else {
      root.appendChild(styleElement)
    }
  }

  return styleElement
}

interface Options extends IOptions {
  id?: string
  root?: Document | ShadowRoot
  plugins: Plugin[]
}

export function cassiopeia(options: Options): Cassiopeia {
  const store: Store = {
    update: TypeUpdate.Locked,
    state: TypeState.Inactive,
    styleElement: undefined,
    iterators: new Map(),
    matcher: undefined,
    root: options.root ?? document,
    id: options.id ?? ID
  }

  const plugins = options.plugins.map((plugin) => plugin(store.iterators))
  const scheduler = createScheduler(store)
  const observer = createMutationObserver(store, scheduler.update)

  const init = () => {
    if (store.state === TypeState.Activating) {
      store.styleElement =
        store.styleElement ?? createStyleElement(store.id, store.root)

      plugins.forEach((values) => values.register(scheduler.update))

      scheduler.lock(false)
      scheduler.update()
      observer.start()
    }
  }

  const start = () => {
    if (store.state !== TypeState.Inactive) {
      store.state = TypeState.Inactive

      observer.stop()
      scheduler.lock(true)
      plugins.forEach((value) => value.deregister())
    }
  }

  const stop = () => {
    if (store.state === TypeState.Inactive) {
      store.state = TypeState.Activating

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
      } else {
        init()
      }
    }
  }

  return {
    [STORE]: store,
    start,
    stop,
    update: scheduler.update,
    isActive: () => store.state === TypeState.Active
  }
}

interface Cassiopeia extends ICassiopeia {
  [STORE]: Store
}

export const renderToString = (
  cassiopeia: Cassiopeia,
  // @ts-expect-error 'strings' is declared but its value is never read
  ...strings: string[]
) => {
  const store = cassiopeia[STORE]

  if (store.state === TypeState.Active) {
    const matcher = createMatcher(
      createVariableIterator(store.root),
      store.iterators
    )

    let cursor = matcher.next()

    while (cursor.done !== true) {
      cursor = matcher.next()
    }

    const value =
      cursor.value === undefined
        ? undefined
        : `<style cassiopeia="${store.id}">${cursor.value}</style>`

    return value
  }

  return undefined
}

export type {
  Options,
  Iterators,
  Iterator,
  Register,
  Deregister,
  Cassiopeia,
  Plugin
}
