/* eslint-disable typescript/no-non-null-assertion */
import { Lang, parse as parseAST } from '@ast-grep/napi'
import { parseVueRequest } from '@vitejs/plugin-vue'
import { type SFCStyleBlock, parse } from '@vue/compiler-sfc'
import { REGEX } from 'cassiopeia'
import MagicString from 'magic-string'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

const ruleSetupClientImportSFCHelper = {
  rule: {
    any: [
      {
        pattern: "import _export_sfc from '$$$'",
      },
      {
        pattern: 'import _export_sfc from "$$$"',
      },
    ],
  },
}

const ruleSetupClientExportSFC = {
  rule: {
    any: [
      {
        pattern: 'export default _sfc_main',
      },
    ],
  },
}

const ruleSetupSSR = {
  rule: {
    any: [
      {
        any: [
          {
            pattern: {
              context: '_sfc_main.setup = ($$$) => {$$$BODY}',
              selector: 'statement_block',
            },
          },
        ],
        inside: {
          inside: {
            inside: {
              regex: '_sfc_main\\.setup',
            },
            kind: 'assignment_expression',
          },
          kind: 'arrow_function',
        },
      },
    ],
  },
}

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
    // eslint-disable-next-line typescript/strict-boolean-expressions
    config.command === 'build' ? !!config.build.sourcemap : true
  state.devToolsEnabled =
    // eslint-disable-next-line typescript/strict-boolean-expressions
    !!config.define!.__VUE_PROD_DEVTOOLS__ || state.isDevelopment
}

const initialState: State = {
  devToolsEnabled: false,
  isDevelopment: false,
  sourceMap: false,
}

const createProductionPlugin = (): Plugin[] => {
  const state: StateProduction = {
    ...initialState,
    variables: new Map<string, Set<string>>(),
  }

  return [
    {
      buildStart() {
        state.variables.clear()
      },
      configResolved: (config) => configResolved(config, state),
      enforce: 'pre',
      name: '@cassiopeia/vite/production-pre',
      transform: {
        async handler(source, id) {
          if (state.isDevelopment) {
            return
          }

          const updateStateVariables = (styles: string) => {
            const set = state.variables.has(filename)
              ? state.variables.get(filename)!
              : (state.variables.set(filename, new Set()), state.variables.get(filename)!)

            for (const match of styles.matchAll(REGEX)) {
              set.add(['--', ...match.slice(1, 3)].join('-'))
            }
          }

          const getStyleContent = async (value: SFCStyleBlock) =>
            value.src === undefined
              ? value.content
              : await readFile(path.resolve(path.dirname(filename), value.src), 'utf8')

          const { filename, query } = parseVueRequest(id)

          if (filename.endsWith('.vue') && query.vue !== true) {
            const parseResult = parse(source)

            for (const style of parseResult.descriptor.styles) {
              const content = await getStyleContent(style)

              updateStateVariables(content)
            }
          }
        },
        order: 'pre',
      },
    },
    {
      enforce: 'post',
      name: '@cassiopeia/vite/production-post',
      transform: {
        handler(source, id, options) {
          if (state.isDevelopment) {
            return
          }

          const isSSR = options?.ssr === true

          const { filename, query } = parseVueRequest(id)

          if (
            state.variables.has(filename) &&
            state.variables.get(filename)?.size !== 0 &&
            Object.values(query).filter((value) => value !== undefined).length === 0
          ) {
            if (isSSR) {
              const found = parseAST(Lang.JavaScript, source).root().find(ruleSetupSSR)
              const match = found?.getMultipleMatches('BODY')
              const position = match?.at(0)?.range().start.index

              if (position === undefined) {
                this.warn(`Update failed`)
              } else {
                const magic = new MagicString(source)

                const variables = Array.from(state.variables.get(filename)!)
                  .map((value) => `"${value}"`)
                  .join(', ')

                magic.appendRight(
                  position,
                  [
                    '',
                    `    const __cassiopeia = __useCassiopeia();`,
                    `    __cassiopeia.add([${variables}]);`,
                    `    __cassiopeia.update(false);`,
                    '',
                  ].join('\n'),
                )

                magic.prepend(
                  `import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"\n`,
                )

                // this.info(`Update successful, ${JSON.stringify(query)}`)

                return state.sourceMap
                  ? {
                      code: magic.toString(),
                      map: magic.generateMap(),
                    }
                  : magic.toString()
              }
            } else {
              const root = parseAST(Lang.JavaScript, source).root()
              const positions = {
                exportSFC: root.find(ruleSetupClientExportSFC)?.range().start.index,
                importSFCHelper: root.find(ruleSetupClientImportSFCHelper)?.range().start.index,
              }

              if (positions.exportSFC === undefined && positions.importSFCHelper === undefined) {
                this.warn(`Update failed`)
                console.log(source)
              } else {
                const magic = new MagicString(source)

                const variables = Array.from(state.variables.get(filename)!)
                  .map((value) => `"${value}"`)
                  .join(', ')

                const content = [
                  '',
                  `const _sfc_setup_cassiopeia = _sfc_main.setup;`,
                  `_sfc_main.setup = (props, ctx) => {`,
                  `const __cassiopeia = __useCassiopeia();`,
                  `__cassiopeia.add([${variables}]);`,
                  `__cassiopeia.update(false);`,
                  `return _sfc_setup_cassiopeia ? _sfc_setup_cassiopeia(props, ctx) : void 0;`,
                  `};`,
                  '',
                ].join('\n')

                if (positions.importSFCHelper !== undefined) {
                  magic.appendLeft(positions.importSFCHelper, content)
                } else {
                  magic.appendRight(positions.exportSFC!, content)
                }

                magic.prepend(
                  `import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"\n`,
                )

                // this.info(`Update successful, ${JSON.stringify(query)}`)

                return state.sourceMap
                  ? {
                      code: magic.toString(),
                      map: magic.generateMap(),
                    }
                  : magic.toString()
              }
            }
          }

          return
        },
        order: 'post',
      },
    },
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
        if (!state.isDevelopment || !state.devToolsEnabled || options?.ssr === true) {
          return
        }

        const { query } = parseVueRequest(id)

        if (query.vue === true && query.type === 'style') {
          const magic = new MagicString(source)

          magic.prepend(
            `import { updateStyle as __cassiopeiaUpdateStyle } from "@cassiopeia/vue"\n`,
          )

          magic.append(
            `\n__cassiopeiaUpdateStyle(__vite__id, __vite__css, import.meta.hot.dispose.bind(import.meta.hot))`,
          )

          return state.sourceMap
            ? {
                code: magic.toString(),
                map: magic.generateMap(),
              }
            : magic.toString()
        }

        return
      },
    },
  }
}

export const cassiopeia: () => Plugin[] = () => [
  createDevelopmentPlugin(),
  ...createProductionPlugin(),
]
