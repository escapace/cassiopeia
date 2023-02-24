/* eslint-disable @typescript-eslint/naming-convention */
import { REGEX } from 'cassiopeia'

export const updateStyle = (
  __vite__id: string,
  __vite__css: string,
  onDispose: (cb: () => void) => void,
  index = 0
) => {
  if (typeof window.__CASSIOPEIA_VUE__ === 'undefined') {
    // 3 seconds
    if (index === 30) {
      console.warn(`[cassiopeia] update failed for '${__vite__id}'`)
    } else {
      setTimeout(
        () => updateStyle(__vite__id, __vite__css, onDispose, index + 1),
        100
      )
    }
  } else {
    const cassiopeia = window.__CASSIOPEIA_VUE__

    const scope = cassiopeia.createScope()

    for (const match of __vite__css.matchAll(REGEX)) {
      scope.add(['--', ...match.slice(1, 3)].join('-'))
    }

    void cassiopeia.update(false)

    onDispose(() => {
      console.info(`[cassiopeia] disposing scope '${__vite__id}'`)
      scope.dispose()
    })
  }
}
