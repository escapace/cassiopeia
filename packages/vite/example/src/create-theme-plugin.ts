import {
  CASSIOPEIA_PLUGIN,
  isReducerActive,
  type CassiopeiaPlugin,
  type CassiopeiaPluginContext,
  type CassiopeiaReducer,
  type TerminatingReducerNext,
} from '../../../cassiopeia'

const themeValues: Record<string, string> = {
  accent: '#7c3aed',
  muted: '#475569',
  primary: '#0f172a',
  surface: '#e2e8f0',
}

export const createThemePlugin = (): CassiopeiaPlugin => ({
  [CASSIOPEIA_PLUGIN]: (context: CassiopeiaPluginContext) => {
    context.reducerFactories.theme = () =>
      (function* createReducer(): CassiopeiaReducer {
        const suffixes: string[] = []
        let token: TerminatingReducerNext<string>

        while (isReducerActive((token = yield))) {
          suffixes.push(token.replace('---theme-', ''))
        }

        if (suffixes.length === 0) {
          return undefined
        }

        return {
          content: `:root { ${suffixes
            .map((suffix) => `--theme-${suffix}: ${themeValues[suffix] ?? '#ef4444'};`)
            .join(' ')} }`,
        }
      })()
  },
})
