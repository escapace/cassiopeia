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

type PostTransformHandler = (
  this: {
    warn: (log: (() => string | LogWithOptionalMessage) | string | LogWithOptionalMessage) => void
  },
  code: string,
  id: string,
  options?: { moduleType: 'js'; ssr?: true },
) => PostTransformResult | Promise<PostTransformResult>

type PreTransformHandler = (this: { warn: () => undefined }, code: string, id: string) => HookResult

export interface CompiledModuleTransformOptions {
  compiledSource: string
  sfcSource: string
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

export const transformCompiledVueModule = async ({
  compiledSource,
  sfcSource,
  ssr = false,
}: CompiledModuleTransformOptions): Promise<CompiledModuleTransformResult> => {
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

  await preTransformHandler.call({ warn: () => undefined }, sfcSource, filename)

  const postTransform = postProductionPlugin.transform
  if (postTransform === undefined || typeof postTransform === 'function') {
    throw new Error('Expected object-based post-production transform hook')
  }

  const postTransformHandler = postTransform.handler as PostTransformHandler
  const result = await postTransformHandler.call(
    {
      warn(log) {
        const resolved = typeof log === 'function' ? log() : log
        warnings.push(
          typeof resolved === 'string' ? resolved : (resolved.message ?? 'Unknown warning'),
        )
      },
    },
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
