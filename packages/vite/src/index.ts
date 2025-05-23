/* eslint-disable typescript/no-unnecessary-boolean-literal-compare */
/* eslint-disable typescript/no-non-null-assertion */
import { Lang, parse as parseAST } from '@ast-grep/napi'
import type { Api as VuePluginApi } from '@vitejs/plugin-vue'
import { parseVueRequest } from '@vitejs/plugin-vue'
import { REGEX } from 'cassiopeia'
import MagicString from 'magic-string'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { shallowRef, type ShallowRef } from 'vue'
import { parse as _parseSFC, type SFCStyleBlock } from 'vue/compiler-sfc'
import { ruleSetupClientExportSFC, ruleSetupClientImportSFCHelper, ruleSetupSSR } from './rules'

const createProperties = (config: ResolvedConfig) => {
  const vueOptions = (
    config.plugins.find((value) => value.name === 'vite:vue') as Plugin<VuePluginApi>
  ).api?.options

  // https://github.com/vitejs/vite-plugin-vue/blob/main/packages/plugin-vue/src/index.ts#L146
  const parseSFC = vueOptions?.compiler?.parse ?? _parseSFC
  const sourceMap = config.command === 'build' ? config.build.sourcemap !== false : true

  // const developmentToolsEnabled =
  //   vueOptions?.features?.prodDevtools === true ||
  //   config?.define?.__VUE_PROD_DEVTOOLS__ === 'true' ||
  //   !config.isProduction

  return {
    // developmentToolsEnabled,
    parseSFC,
    sourceMap,
  }
}

type Properties = ReturnType<typeof createProperties>

const createProductionPlugins = (properties: ShallowRef<Properties | undefined>): Plugin[] => {
  const indice = new Map<string, Set<string>>()

  return [
    {
      enforce: 'pre',
      name: '@cassiopeia/vite:pre-production',

      apply: (_, { command, isPreview }) => (command === 'serve' ? isPreview === true : true),

      buildStart() {
        indice.clear()
      },

      transform: {
        async handler(source, id) {
          const updateStateVariables = (styles: string) => {
            const set = indice.has(filename)
              ? indice.get(filename)!
              : (indice.set(filename, new Set()), indice.get(filename)!)

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
            const parseResult = _parseSFC(source)

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
      name: '@cassiopeia/vite:post-production',

      apply: (_, { command, isPreview }) => (command === 'serve' ? isPreview === true : true),

      transform: {
        handler(source, id, options) {
          const isSSR = options?.ssr === true

          const { filename, query } = parseVueRequest(id)

          if (
            indice.has(filename) &&
            indice.get(filename)?.size !== 0 &&
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

                const variables = Array.from(indice.get(filename)!)
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

                return properties.value!.sourceMap === true
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

                const addVariables = Array.from(indice.get(filename)!)
                  .map((value) => `"${value}"`)
                  .join(', ')

                const content = [
                  '',
                  `const _sfc_setup_cassiopeia = _sfc_main.setup;`,
                  `_sfc_main.setup = (props, ctx) => {`,
                  `const __cassiopeia = __useCassiopeia();`,
                  `__cassiopeia.add([${addVariables}]);`,
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

                return properties.value!.sourceMap === true
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

const createDevelopmentPlugins = (properties: ShallowRef<Properties | undefined>): Plugin[] => [
  {
    enforce: 'post',
    name: '@cassiopeia/vite:development',

    apply: (_, { command, isPreview }) => command === 'serve' && isPreview === false,

    transform: {
      handler(source, id, options) {
        if (options?.ssr === true) {
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

          return properties.value!.sourceMap
            ? {
                code: magic.toString(),
                map: magic.generateMap(),
              }
            : magic.toString()
        }

        return
      },
    },
  },
]

export const cassiopeia: () => Plugin[] = () => {
  const properties = shallowRef<Properties>()

  return [
    {
      name: '@cassiopeia/vite:configResolved',

      configResolved(value) {
        properties.value = createProperties(value)
      },
    },
    ...createDevelopmentPlugins(properties),
    ...createProductionPlugins(properties),
  ]
}
