import type { Plugin, ResolvedConfig } from 'vite'
import { cassiopeia } from '../index'

interface LogWithOptionalMessage {
  message?: string
}

type HookResult = Promise<void> | void

type BuildStartHook = (() => HookResult) | { handler?: () => HookResult }
type ConfigResolvedHook =
  | ((config: ResolvedConfig) => HookResult)
  | { handler?: (config: ResolvedConfig) => HookResult }

type PostTransformResult = string | { code?: string } | undefined

interface TransformContextFixture {
  environment: {
    config: {
      consumer: 'client' | 'server'
    }
    mode: 'build' | 'dev'
  }
  resolve: (source: string, importer?: string, options?: { skipSelf?: boolean }) => Promise<{
    id: string
  } | null>
  warn: (log: (() => string | LogWithOptionalMessage) | string | LogWithOptionalMessage) => void
}

type PostTransformHandler = (
  this: TransformContextFixture,
  code: string,
  id: string,
  options?: { moduleType: 'js'; ssr?: true },
) => PostTransformResult | Promise<PostTransformResult>

type PreTransformHandler = (this: TransformContextFixture, code: string, id: string) => HookResult

export interface CompiledModuleTransformOptions {
  compiledSource: string
  sfcSource: string
  consumer?: 'client' | 'server'
  environmentMode?: 'build' | 'dev'
  resolvedImportSource?: string
  ssr?: boolean
}

export interface CompiledModuleTransformResult {
  code: string | undefined
  warnings: string[]
}

const createResolvedConfig = (): ResolvedConfig =>
  ({
    build: {
      sourcemap: false,
    },
    command: 'build',
    plugins: [
      {
        api: {
          options: {},
        },
        name: 'vite:vue',
      },
    ],
  }) as unknown as ResolvedConfig

const getNamedPlugin = (plugins: Plugin[], name: string): Plugin => {
  const plugin = plugins.find((value) => value.name === name)

  if (plugin === undefined) {
    throw new Error(`Expected plugin '${name}'`)
  }

  return plugin
}

export const transformCompiledVueModule = async (
  options: CompiledModuleTransformOptions,
): Promise<CompiledModuleTransformResult> => {
  const {
    compiledSource,
    environmentMode = 'build',
    resolvedImportSource = '@cassiopeia/vue',
    sfcSource,
    ssr = false,
  } = options
  const consumer = options.consumer ?? (ssr ? 'server' : 'client')
  const plugins = cassiopeia()
  const configPlugin = getNamedPlugin(plugins, '@cassiopeia/vite:configResolved')
  const preProductionPlugin = getNamedPlugin(plugins, '@cassiopeia/vite:pre-production')
  const postProductionPlugin = getNamedPlugin(plugins, '@cassiopeia/vite:post-production')
  const filename = '/virtual/App.vue'
  const warnings: string[] = []

  const configResolved = configPlugin.configResolved as ConfigResolvedHook | undefined
  const resolvedConfig = createResolvedConfig()

  await (typeof configResolved === 'function'
    ? configResolved(resolvedConfig)
    : configResolved?.handler?.(resolvedConfig))

  const buildStart = preProductionPlugin.buildStart as BuildStartHook | undefined

  await (typeof buildStart === 'function' ? buildStart() : buildStart?.handler?.())

  const preTransform = preProductionPlugin.transform
  if (preTransform === undefined || typeof preTransform === 'function') {
    throw new Error('Expected object-based pre-production transform hook')
  }

  const preTransformHandler = preTransform.handler as unknown as PreTransformHandler

  const transformContext: TransformContextFixture = {
    environment: {
      config: {
        consumer,
      },
      mode: environmentMode,
    },
    resolve: async () => await Promise.resolve({ id: resolvedImportSource }),
    warn(log) {
      const resolved = typeof log === 'function' ? log() : log
      warnings.push(typeof resolved === 'string' ? resolved : (resolved.message ?? 'Unknown warning'))
    },
  }

  await preTransformHandler.call(transformContext, sfcSource, filename)

  const postTransform = postProductionPlugin.transform
  if (postTransform === undefined || typeof postTransform === 'function') {
    throw new Error('Expected object-based post-production transform hook')
  }

  const postTransformHandler = postTransform.handler as PostTransformHandler
  const result = await postTransformHandler.call(
    transformContext,
    compiledSource,
    filename,
    ssr ? { moduleType: 'js', ssr: true } : undefined,
  )

  return {
    code:
      typeof result === 'string'
        ? result
        : typeof result?.code === 'string'
          ? result.code
          : undefined,
    warnings,
  }
}
