/* eslint-disable typescript/naming-convention */
import { CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX } from 'cassiopeia'

export const updateStyle = (
  __vite__id: string,
  __vite__css: string,
  onDispose: (callback: () => void) => void,
  index = 0,
) => {
  if (globalThis.__CASSIOPEIA__ === undefined) {
    // 3 seconds
    if (index === 30) {
      console.warn(`[cassiopeia] update failed for '${__vite__id}'`)
    } else {
      setTimeout(() => updateStyle(__vite__id, __vite__css, onDispose, index + 1), 100)
    }
  } else {
    const variables = Array.from(
      __vite__css.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX),
    ).map((value) => ['--', ...value.splice(1)].join('-'))

    if (variables.length !== 0) {
      const cassiopeia = globalThis.__CASSIOPEIA__

      const scope = cassiopeia.createScope()

      if (scope.addMany(variables)) {
        void cassiopeia.update()
      }

      onDispose(() => {
        console.warn(`[cassiopeia] disposing scope '${__vite__id}'`)
        scope.dispose()
      })
    }
  }
}
