import { createCassiopeia } from '../../../vue'
import { createStyleElementSubscription } from '../../../cassiopeia'
import { createApp, createSSRApp } from 'vue'
import App from './App.vue'
import { createThemePlugin } from './create-theme-plugin'

export interface CreateExampleAppOptions {
  hydrate?: boolean
}

export const createExampleApp = (options: CreateExampleAppOptions = {}) => {
  const cassiopeia = createCassiopeia({ deferEvery: 8 })
  cassiopeia.use(createThemePlugin())

  if (!import.meta.env.SSR) {
    cassiopeia.subscribe(
      createStyleElementSubscription({ method: 'overwrite', namespace: 'example' }),
    )
  }

  const app = (options.hydrate === true ? createSSRApp : createApp)(App)
  app.use(cassiopeia)

  return { app, cassiopeia }
}
