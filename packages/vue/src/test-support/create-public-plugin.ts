import {
  CASSIOPEIA_PLUGIN,
  isReducerActive,
  type CassiopeiaPlugin,
  type CassiopeiaPluginContext,
  type CassiopeiaReducer,
  type TerminatingReducerNext,
} from 'cassiopeia'

export interface PublicPluginHarness {
  key: string
  plugin: CassiopeiaPlugin
  runs: string[][]
}

export const createPublicPlugin = (key = 'theme'): PublicPluginHarness => {
  const runs: string[][] = []

  const plugin: CassiopeiaPlugin = {
    [CASSIOPEIA_PLUGIN]: (context: CassiopeiaPluginContext) => {
      context.reducerFactories[key] = () =>
        (function* createReducer(): CassiopeiaReducer {
          const markers: string[] = []
          let token: TerminatingReducerNext<string>

          while (isReducerActive((token = yield))) {
            markers.push(token)
          }

          runs.push([...markers])

          if (markers.length === 0) {
            return undefined
          }

          return {
            content: `:root { ${markers
              .map((marker, index) => `--${key}-${marker.replace(`---${key}-`, '')}: ${index + 1};`)
              .join(' ')} }`,
          }
        })()
    },
  }

  return { key, plugin, runs }
}
