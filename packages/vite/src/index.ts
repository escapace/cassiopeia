import { parseVueRequest } from '@vitejs/plugin-vue'
import { REGEX } from 'cassiopeia'
import MagicString from 'magic-string'
import { ResolvedConfig, type Plugin } from 'vite'

declare module '@vitejs/plugin-vue' {
  interface VueQuery {
    setup?: string
  }
}

interface State {
  isProduction: boolean
  sourceMap: boolean
  devToolsEnabled: boolean
}

interface StateProduction extends State {
  variables: Map<string, Set<string>>
}

const configResolved = (config: ResolvedConfig, state: State) => {
  // https://github.com/vitejs/vite-plugin-vue/blob/main/packages/plugin-vue/src/index.ts#L146
  state.isProduction = config.isProduction
  state.sourceMap =
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    config.command === 'build' ? !!config.build.sourcemap : true
  state.devToolsEnabled =
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-non-null-assertion
    !!config.define!.__VUE_PROD_DEVTOOLS__ || !config.isProduction
}

const initialState: State = {
  isProduction: false,
  sourceMap: false,
  devToolsEnabled: false
}

const createProdPlugin = (): Plugin[] => {
  const state: StateProduction = {
    ...initialState,
    variables: new Map<string, Set<string>>()
  }

  return [
    {
      name: '@cassiopeia/vite',
      enforce: 'pre',
      configResolved: (config) => configResolved(config, state),
      buildStart() {
        state.variables.clear()
      },
      transform: {
        handler(source, id) {
          if (!state.isProduction) {
            return
          }

          const { filename, query } = parseVueRequest(id)

          if (query.vue === true && query.type === 'style') {
            const set = new Set<string>()

            for (const match of source.matchAll(REGEX)) {
              set.add(['--', ...match.slice(1, 3)].join('-'))
            }

            if (set.size === 0) {
              if (state.variables.has(filename)) {
                state.variables.delete(filename)
              }
            } else {
              state.variables.set(filename, set)
            }
          }
        }
      }
    },
    {
      name: '@cassiopeia/vite',
      enforce: 'post',
      transform: {
        handler(source, id) {
          if (!state.isProduction) {
            return
          }

          const { filename, query } = parseVueRequest(id)

          if (
            query.type === 'script' &&
            query.vue === true &&
            query.setup === 'true' &&
            state.variables.has(filename)
          ) {
            const magic = new MagicString(source)
            magic.prepend(
              `import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"\n`
            )

            const positionString = 'setup(__props) {'
            const position =
              source.indexOf(positionString) + positionString.length

            if (position === -1) {
              this.warn(`[cassiopeia]: unable to update '${filename}'`)
            }

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const variables = Array.from(state.variables.get(filename)!)
              .map((value) => `"${value}"`)
              .join(', ')

            magic.appendRight(
              position,
              [
                '',
                `    const __cassiopeia = __useCassiopeia()`,
                `    __cassiopeia.add([${variables}])`,
                `    __cassiopeia.update(false)`
              ].join('\n')
            )

            if (state.sourceMap) {
              return {
                code: magic.toString(),
                map: magic.generateMap()
              }
            } else {
              return magic.toString()
            }
          }

          return undefined
        }
      }
    }
  ]
}

const createDevPlugin = (): Plugin => {
  const state: State = { ...initialState }

  return {
    name: '@cassiopeia/vite',
    enforce: 'post',
    configResolved: (config) => configResolved(config, state),
    transform: {
      handler(source, id, opts) {
        if (
          state.isProduction ||
          !state.devToolsEnabled ||
          opts?.ssr === true
        ) {
          return
        }

        const { query } = parseVueRequest(id)

        if (query.vue === true && query.type === 'style') {
          const magic = new MagicString(source)

          magic.prepend(
            `import { updateStyle as __cassiopeiaUpdateStyle } from "@cassiopeia/vue"\n`
          )

          magic.append(
            `\n__cassiopeiaUpdateStyle(__vite__id, __vite__css, import.meta.hot.dispose)`
          )

          if (state.sourceMap) {
            return {
              code: magic.toString(),
              map: magic.generateMap()
            }
          } else {
            return magic.toString()
          }
        }

        return undefined
      }
    }
  }
}

export const cassiopeia: () => Plugin[] = () => {
  return [...createProdPlugin(), createDevPlugin()]
}
