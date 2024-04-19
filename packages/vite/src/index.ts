/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { parseVueRequest } from '@vitejs/plugin-vue'
import { type SFCStyleBlock, parse } from '@vue/compiler-sfc'
import { REGEX } from 'cassiopeia'
import { readFile } from 'node:fs/promises'
import MagicString from 'magic-string'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

declare module '@vitejs/plugin-vue' {
  interface VueQuery {
    setup?: string
  }
}

interface State {
  devToolsEnabled: boolean
  isDevelopment: boolean
  sourceMap: boolean
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
  devToolsEnabled: false,
  isDevelopment: false,
  sourceMap: false
}

const createProductionPlugin = (): Plugin[] => {
  const state: StateProduction = {
    ...initialState,
    variables: new Map<string, Set<string>>()
  }

  return [
    {
      buildStart() {
        state.variables.clear()
      },
      configResolved: (config) => configResolved(config, state),
      load: {
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
            return value.src === undefined
              ? value.content
              : await readFile(
                  path.resolve(path.dirname(filename), value.src),
                  'utf8'
                )
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
        },
        order: 'pre'
      },
      name: '@cassiopeia/vite/production',
      transform: {
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

              return state.sourceMap
                ? {
                    code: magic.toString(),
                    map: magic.generateMap()
                  }
                : magic.toString()
            }
          }

          return
        },
        order: 'post'
      }
    }
  ]
}

const createDevelopmentPlugin = (): Plugin => {
  const state: State = { ...initialState }

  return {
    configResolved: (config) => configResolved(config, state),
    enforce: 'post',
    name: '@cassiopeia/vite/development',
    transform: {
      handler(source, id, options) {
        if (
          !state.isDevelopment ||
          !state.devToolsEnabled ||
          options?.ssr === true
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

          return state.sourceMap
            ? {
                code: magic.toString(),
                map: magic.generateMap()
              }
            : magic.toString()
        }

        return
      }
    }
  }
}

export const cassiopeia: () => Plugin[] = () => {
  return [createDevelopmentPlugin(), ...createProductionPlugin()]
}
