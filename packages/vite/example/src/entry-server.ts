import { renderStyleSheets } from '../../../cassiopeia'
import { renderToString } from 'vue/server-renderer'
import { createExampleApp } from './create-app'
import { themeMarkers } from './theme-markers'

export interface RenderResult {
  appHtml: string
  head: string
}

export const render = async (): Promise<RenderResult> => {
  const { app, cassiopeia } = createExampleApp({ hydrate: true })
  const scope = cassiopeia.createScope()

  try {
    scope.addMany(themeMarkers)

    const appHtml = await renderToString(app)
    await cassiopeia.update()

    const head = (renderStyleSheets(cassiopeia) ?? [])
      .map(
        (style) =>
          `<style ${style.media === undefined ? '' : `media="${style.media}" `}cassiopeia-key="${style.key}" cassiopeia-index="${style.index}">${style.content}</style>`,
      )
      .join('\n')

    return { appHtml, head }
  } finally {
    scope.dispose()
    await cassiopeia.dispose()
  }
}
