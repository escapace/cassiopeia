/* eslint-disable @typescript-eslint/naming-convention */
import { REGEX } from 'cassiopeia'

export const updateStyle = (
  __vite__id: string,
  __vite__css: string,
  onDispose: (callback: () => void) => void,
  index = 0
) => {
  if (window.__CASSIOPEIA_VUE__ === undefined) {
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
    const variables = Array.from(__vite__css.matchAll(REGEX)).map((value) =>
      ['--', ...value.slice(1, 3)].join('-')
    )

    if (variables.length !== 0) {
      const cassiopeia = window.__CASSIOPEIA_VUE__

      const scope = cassiopeia.createScope()

      scope.add(variables)

      void cassiopeia.update(false)

      onDispose(() => {
        console.warn(`[cassiopeia] disposing scope '${__vite__id}'`)
        scope.dispose()
      })
    }
  }
}
