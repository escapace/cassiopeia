/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { parseVueRequest } from '@vitejs/plugin-vue'
import { SFCStyleBlock, parse } from '@vue/compiler-sfc'
import { REGEX } from 'cassiopeia'
import { readFile } from 'fs/promises'
import MagicString from 'magic-string'
import path from 'path'
import type { Plugin, ResolvedConfig } from 'vite'

declare module '@vitejs/plugin-vue' {
  interface VueQuery {
    setup?: string
  }
}

interface State {
  isDevelopment: boolean
  sourceMap: boolean
  devToolsEnabled: boolean
}

interface StateProduction extends State {
  variables: Map<string, Set<string>>
}

const configResolved = (config: ResolvedConfig, state: State) => {
  // https://github.com/vitejs/vite-plugin-vue/blob/main/packages/plugin-vue/src/index.ts#L146
  state.isDevelopment = config.mode === 'development'
  state.sourceMap =
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    config.command === 'build' ? !!config.build.sourcemap : true
  state.devToolsEnabled =
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    !!config.define!.__VUE_PROD_DEVTOOLS__ || state.isDevelopment
}

const initialState: State = {
  isDevelopment: false,
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
      name: '@cassiopeia/vite/production',
      configResolved: (config) => configResolved(config, state),
      buildStart() {
        state.variables.clear()
      },
      load: {
        order: 'pre',
        async handler(id) {
          if (state.isDevelopment) {
            return
          }
          const updateStateVariables = (styles: string) => {
            const set = state.variables.has(filename)
              ? state.variables.get(filename)!
              : (state.variables.set(filename, new Set()),
                state.variables.get(filename)!)

            for (const match of styles.matchAll(REGEX)) {
              set.add(['--', ...match.slice(1, 3)].join('-'))
            }
          }

          const getStyleContent = async (value: SFCStyleBlock) => {
            if (value.src === undefined) {
              return value.content
            } else {
              return await readFile(
                path.resolve(path.dirname(filename), value.src),
                'utf8'
              )
            }
          }

          const { filename, query } = parseVueRequest(id)

          if (filename.endsWith('.vue') && query.vue !== true) {
            const source = await readFile(filename, 'utf8')

            const parseResult = parse(source)

            for (const style of parseResult.descriptor.styles) {
              const content = await getStyleContent(style)

              updateStateVariables(content)
            }
          }
        }
      },
      transform: {
        order: 'post',
        handler(source, id) {
          if (state.isDevelopment) {
            return
          }

          const { filename, query } = parseVueRequest(id)

          if (
            state.variables.has(filename) &&
            (query.vue === true || query.vue === undefined) &&
            (query.type === 'script' || query.type === undefined)
          ) {
            const positionString = 'setup(__props) {'
            let position = source.indexOf(positionString)

            if (position === -1) {
              // this.warn(
              //   `[cassiopeia]: unable to update '${filename}', ${JSON.stringify(
              //     query
              //   )}`
              // )
            } else {
              position += positionString.length

              const magic = new MagicString(source)

              magic.prepend(
                `import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"\n`
              )

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
    name: '@cassiopeia/vite/development',
    enforce: 'post',
    configResolved: (config) => configResolved(config, state),
    transform: {
      handler(source, id, opts) {
        if (
          !state.isDevelopment ||
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
            `\n__cassiopeiaUpdateStyle(__vite__id, __vite__css, import.meta.hot.dispose.bind(import.meta.hot))`
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
  return [createDevPlugin(), ...createProdPlugin()]
}
