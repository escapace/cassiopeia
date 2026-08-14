/* eslint-disable typescript/no-unnecessary-boolean-literal-compare */

import { Lang, parse as parseAST } from '@ast-grep/napi'
import type { Api as VuePluginApi } from '@vitejs/plugin-vue'
import { parseVueRequest } from '@vitejs/plugin-vue'
import { CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX } from 'cassiopeia'
import MagicString from 'magic-string'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { shallowRef, type ShallowRef } from 'vue'
import { parse as parseSFCDefault, type SFCStyleBlock } from 'vue/compiler-sfc'
import { ruleSetupClientExportSFC, ruleSetupClientImportSFCHelper, ruleSetupSSR } from './rules'

const CASSIOPEIA_VUE_IMPORT = '@cassiopeia/vue'
const VUE_PLUGIN_NAME = 'vite:vue'

type TransformResult = string | { code: string; map: ReturnType<MagicString['generateMap']> } | undefined
type VueRequestQuery = ReturnType<typeof parseVueRequest>['query']

interface CompiledModuleMode {
  isBuild: boolean
  isDevServerConsumer: boolean
  isPreview: boolean
  isServerConsumer: boolean
}

interface TransformEnvironment {
  config: {
    consumer: string
  }
  mode: string
}

const createProperties = (config: ResolvedConfig) => {
  const vueOptions = (config.plugins.find((value) => value.name === VUE_PLUGIN_NAME) as Plugin<
    VuePluginApi
  >).api?.options

  // https://github.com/vitejs/vite-plugin-vue/blob/main/packages/plugin-vue/src/index.ts#L146
  const parseSFC = vueOptions?.compiler?.parse ?? parseSFCDefault
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

const createCompiledModuleMode = (
  environment: TransformEnvironment,
  isPreview: boolean,
): CompiledModuleMode => ({
  isBuild: environment.mode === 'build',
  isDevServerConsumer:
    environment.mode === 'dev' && isPreview !== true && environment.config.consumer === 'server',
  isPreview,
  isServerConsumer: environment.config.consumer === 'server',
})

const usesCompiledModuleRegistration = (mode: CompiledModuleMode) =>
  mode.isBuild || mode.isPreview || mode.isDevServerConsumer

const isEmptyVueQuery = (query: VueRequestQuery) =>
  Object.values(query).every((value) => value === undefined)

const isVueMainRequest = (filename: string, query: VueRequestQuery) =>
  filename.endsWith('.vue') && isEmptyVueQuery(query)

const createUseCassiopeiaImport = (source: string) =>
  `import { useCassiopeia as __useCassiopeia } from ${JSON.stringify(source)}\n`

const createSetupBodyInjection = (variables: string) =>
  [
    '',
    `const __cassiopeia = __useCassiopeia();`,
    `if (__cassiopeia.addMany([${variables}])) void __cassiopeia.update();`,
    '',
  ].join('\n')

const createClientSetupInjection = (variables: string) =>
  [
    '',
    `const _sfc_setup_cassiopeia = _sfc_main.setup;`,
    `_sfc_main.setup = (props, ctx) => {`,
    `const __cassiopeia = __useCassiopeia();`,
    `if (__cassiopeia.addMany([${variables}])) void __cassiopeia.update();`,
    `return _sfc_setup_cassiopeia ? _sfc_setup_cassiopeia(props, ctx) : void 0;`,
    `};`,
    '',
  ].join('\n')

const createDevelopmentStyleModuleInjection = () =>
  [
    '',
    `const __cassiopeiaDisposeStyle = (callback) => {`,
    `let disposed = false;`,
    `const dispose = () => {`,
    `if (disposed) return;`,
    `disposed = true;`,
    `callback();`,
    `};`,
    `import.meta.hot.dispose(dispose);`,
    `import.meta.hot.prune(dispose);`,
    `};`,
    `__cassiopeiaUpdateStyle(__vite__id, __vite__css, __cassiopeiaDisposeStyle)`,
  ].join('\n')

const formatVariableArray = (variables: Iterable<string>) =>
  Array.from(variables).map((value) => JSON.stringify(value)).join(', ')

const createTransformResult = (magic: MagicString, properties: Properties): TransformResult =>
  properties.sourceMap === true
    ? {
        code: magic.toString(),
        map: magic.generateMap(),
      }
    : magic.toString()

const extractCassiopeiaVariablesFromStyle = (style: string): Set<string> => {
  const variables = new Set<string>()

  for (const match of style.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)) {
    variables.add(['--', ...match.slice(1, 3)].join('-'))
  }

  return variables
}

const readStyleBlockContent = async (style: SFCStyleBlock, filename: string): Promise<string> => {
  if (style.src === undefined) {
    return style.content
  }

  const stylePath = path.resolve(path.dirname(filename), style.src)

  try {
    return await readFile(stylePath, 'utf8')
  } catch (error) {
    throw new Error(`Failed to read Cassiopeia style source '${style.src}' referenced by '${filename}'`, {
      cause: error,
    })
  }
}

const scanSFCStyleVariables = async (
  source: string,
  filename: string,
  properties: Properties | undefined,
): Promise<Set<string>> => {
  const variables = new Set<string>()
  const parseSFC = properties?.parseSFC ?? parseSFCDefault
  const parseResult = parseSFC(source, {
    filename,
    sourceMap: properties?.sourceMap,
  })

  for (const style of parseResult.descriptor.styles) {
    const content = await readStyleBlockContent(style, filename)

    for (const variable of extractCassiopeiaVariablesFromStyle(content)) {
      variables.add(variable)
    }
  }

  return variables
}

// Vite's dev SSR module runner resolves injected imports from the transformed
// module's temporary/app root. Resolve this specifier before injecting it so
// dev SSR uses the same alias and dependency graph as the original app code.
const resolveDevelopmentSSRUseCassiopeiaImportSource = async (
  id: string,
  resolve: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<
    { id: string } | null
  >,
) => (await resolve(CASSIOPEIA_VUE_IMPORT, id, { skipSelf: true }))?.id ?? CASSIOPEIA_VUE_IMPORT

const patchSSRCompiledModule = ({
  filename,
  importSource,
  properties,
  source,
  variables,
  warn,
}: {
  filename: string
  importSource: string
  properties: Properties
  source: string
  variables: Iterable<string>
  warn: (message: string) => void
}): TransformResult => {
  const found = parseAST(Lang.JavaScript, source).root().find(ruleSetupSSR)
  const match = found?.getMultipleMatches('BODY')
  const position = match?.at(0)?.range().start.index

  if (position === undefined) {
    warn(`[cassiopeia] failed to inject SSR registration into '${filename}'`)
    return
  }

  const magic = new MagicString(source)

  magic.appendRight(position, createSetupBodyInjection(formatVariableArray(variables)))
  magic.prepend(createUseCassiopeiaImport(importSource))

  return createTransformResult(magic, properties)
}

const patchClientCompiledModule = ({
  filename,
  properties,
  source,
  variables,
  warn,
}: {
  filename: string
  properties: Properties
  source: string
  variables: Iterable<string>
  warn: (message: string) => void
}): TransformResult => {
  const root = parseAST(Lang.JavaScript, source).root()
  const positions = {
    exportSFC: root.find(ruleSetupClientExportSFC)?.range().start.index,
    importSFCHelper: root.find(ruleSetupClientImportSFCHelper)?.range().start.index,
  }

  if (positions.exportSFC === undefined && positions.importSFCHelper === undefined) {
    warn(`[cassiopeia] failed to inject client registration into '${filename}'`)
    return
  }

  const magic = new MagicString(source)
  const content = createClientSetupInjection(formatVariableArray(variables))

  if (positions.importSFCHelper !== undefined) {
    magic.appendLeft(positions.importSFCHelper, content)
  } else {
    magic.appendRight(positions.exportSFC!, content)
  }

  magic.prepend(createUseCassiopeiaImport(CASSIOPEIA_VUE_IMPORT))

  return createTransformResult(magic, properties)
}

// Build and preview always use compiled-module registration. Development
// server-consumer environments use the same path because Vite's server-side CSS
// modules do not expose the browser-only `__vite__css` value used by the dev
// client style-module path.
const createCompiledModuleRegistrationPlugins = (
  properties: ShallowRef<Properties | undefined>,
): Plugin[] => {
  const styleVariablesByFilename = new Map<string, Set<string>>()
  let isPreview = false

  return [
    {
      enforce: 'pre',
      name: '@cassiopeia/vite:pre-production',

      apply: (_, environment) => {
        isPreview = environment.isPreview === true

        return environment.command === 'build' || environment.command === 'serve'
      },

      buildStart() {
        styleVariablesByFilename.clear()
      },

      transform: {
        order: 'pre',
        async handler(source, id) {
          const mode = createCompiledModuleMode(this.environment, isPreview)

          if (!usesCompiledModuleRegistration(mode)) {
            return
          }

          const { filename, query } = parseVueRequest(id)

          if (isVueMainRequest(filename, query)) {
            // Store a fresh set on every scan. Build scans are one-shot, while
            // dev SSR uses a long-lived server where stale compile metadata must
            // not survive file edits.
            styleVariablesByFilename.set(
              filename,
              await scanSFCStyleVariables(source, filename, properties.value),
            )
          }
        },
      },
    },
    {
      enforce: 'post',
      name: '@cassiopeia/vite:post-production',

      apply: (_, environment) => {
        isPreview = environment.isPreview === true

        return environment.command === 'build' || environment.command === 'serve'
      },

      transform: {
        order: 'post',
        async handler(source, id) {
          const currentProperties = properties.value
          const mode = createCompiledModuleMode(this.environment, isPreview)

          if (currentProperties === undefined || !usesCompiledModuleRegistration(mode)) {
            return
          }

          const { filename, query } = parseVueRequest(id)
          const variables = styleVariablesByFilename.get(filename)

          if (variables === undefined || variables.size === 0 || !isVueMainRequest(filename, query)) {
            return
          }

          if (mode.isServerConsumer) {
            const importSource = mode.isDevServerConsumer
              ? await resolveDevelopmentSSRUseCassiopeiaImportSource(id, this.resolve.bind(this))
              : CASSIOPEIA_VUE_IMPORT

            return patchSSRCompiledModule({
              filename,
              importSource,
              properties: currentProperties,
              source,
              variables,
              warn: this.warn.bind(this),
            })
          }

          return patchClientCompiledModule({
            filename,
            properties: currentProperties,
            source,
            variables,
            warn: this.warn.bind(this),
          })
        },
      },
    },
  ]
}

const createDevelopmentPlugins = (properties: ShallowRef<Properties | undefined>): Plugin[] => [
  {
    enforce: 'post',
    name: '@cassiopeia/vite:development',

    apply: (_, { command, isPreview }) => command === 'serve' && isPreview !== true,

    transform: {
      handler(source, id) {
        if (this.environment.config.consumer !== 'client') {
          return
        }

        const { query } = parseVueRequest(id)

        if (query.vue === true && query.type === 'style') {
          const magic = new MagicString(source)

          magic.prepend(
            `import { updateStyle as __cassiopeiaUpdateStyle } from "@cassiopeia/vue"\n`,
          )
          magic.append(createDevelopmentStyleModuleInjection())

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
    ...createCompiledModuleRegistrationPlugins(properties),
  ]
}
