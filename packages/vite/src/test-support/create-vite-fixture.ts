import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import vue, { type Options as VuePluginOptions } from '@vitejs/plugin-vue'
import { build, createServer, type InlineConfig, type Plugin, type ViteDevServer } from 'vite'
import { cassiopeia } from '../index'
import { createTemporaryDirectory } from './create-temporary-directory'

export interface VueProjectOptions {
  appSource: string
  extraFiles?: Record<string, string>
  vueOptions?: VuePluginOptions
}

export interface VueProject {
  appModuleId: string
  root: string
  buildServerEntry: () => Promise<string>
  captureClientAppModule: () => Promise<string>
  captureServerAppModule: () => Promise<string>
  cleanup: () => Promise<void>
  transformDevelopmentRequest: (request?: string, options?: { ssr?: boolean }) => Promise<string>
  withDevelopmentServer: <Result>(
    platform: 'browser' | 'node',
    callback: (server: ViteDevServer) => Promise<Result>,
  ) => Promise<Result>
  withDevelopmentServerEntry: <Entry, Result>(
    callback: (entry: Entry) => Promise<Result>,
  ) => Promise<Result>
}

const createClientEntry = () => `
import { createApp } from 'vue'
import { createCassiopeia } from '@cassiopeia/vue'
import App from './App.vue'

const app = createApp(App)
app.use(createCassiopeia())
app.mount('#app')
`

const createServerEntry = () => `
import {
  CASSIOPEIA_PLUGIN,
  isReducerActive,
  renderStyleSheets,
  type CassiopeiaPlugin,
  type CassiopeiaPluginContext,
  type CassiopeiaReducer,
  type TerminatingReducerNext,
} from 'cassiopeia'
import { createSSRApp } from 'vue'
import { createCassiopeia } from '@cassiopeia/vue'
import App from './App.vue'

const themePlugin: CassiopeiaPlugin = {
  [CASSIOPEIA_PLUGIN]: (context: CassiopeiaPluginContext) => {
    context.reducerFactories.theme = () =>
      (function* createReducer(): CassiopeiaReducer {
        const markers: string[] = []
        let token: TerminatingReducerNext<string>

        while (isReducerActive((token = yield))) {
          markers.push(token)
        }

        if (markers.length === 0) {
          return undefined
        }

        return {
          content:
            ':root { ' +
            markers
              .map((marker, index) => \`--theme-\${marker.replace('---theme-', '')}: \${index + 1};\`)
              .join(' ') +
            ' }',
        }
      }())
  },
}

const registrations: string[][] = []
let updateCount = 0

export const createServerApp = () => {
  const cassiopeia = createCassiopeia()
  const createScope = cassiopeia.createScope.bind(cassiopeia)

  cassiopeia.createScope = () => {
    const scope = createScope()
    const addMany = scope.addMany.bind(scope)
    const update = scope.update.bind(scope)
    const updateSync = scope.updateSync.bind(scope)

    scope.addMany = (values) => {
      const captured = Array.from(values)
      registrations.push(captured)
      return addMany(captured)
    }

    scope.update = async () => {
      updateCount += 1
      await update()
    }

    scope.updateSync = () => {
      updateCount += 1
      updateSync()
    }

    return scope
  }

  cassiopeia.use(themePlugin)

  const app = createSSRApp(App)
  app.use(cassiopeia)

  return { app, cassiopeia }
}

export const readRegistrations = () => registrations.map((values) => [...values])
export const readStyles = (cassiopeia: ReturnType<typeof createCassiopeia>) =>
  renderStyleSheets(cassiopeia)
export const readUpdateCount = () => updateCount
`

const createIndexHtml = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>cassiopeia fixture</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`

const createConfig = (
  root: string,
  platform: 'browser' | 'node',
  plugins: Plugin[] = [],
  vueOptions?: VuePluginOptions,
): InlineConfig => ({
  define: {
    __ENVIRONMENT__: JSON.stringify('development'),
    __PLATFORM__: JSON.stringify(platform),
    __VERSION__: JSON.stringify('test'),
  },
  logLevel: 'silent',
  plugins: [vue(vueOptions), ...cassiopeia(), ...plugins],
  resolve: {
    alias: {
      '@cassiopeia/vue': path.resolve(process.cwd(), '../vue/src/index.ts'),
    },
  },
  root,
})

const createCapturePlugin = (
  appModuleId: string,
  ssr: boolean,
  onCapture: (code: string) => void,
): Plugin => ({
  enforce: 'post',
  name: 'capture-app-module',
  transform: {
    order: 'post',
    handler(code, id, options) {
      if (id === appModuleId && (options?.ssr === true) === ssr) {
        onCapture(code)
      }
    },
  },
})

const writeOutputFiles = async (
  outputDirectory: string,
  result: Awaited<ReturnType<typeof build>>,
): Promise<string> => {
  const bundles = Array.isArray(result) ? result : [result]
  let entryPath: string | undefined

  for (const bundle of bundles) {
    if (!('output' in bundle)) {
      throw new Error('Expected build output files')
    }

    for (const artifact of bundle.output) {
      const artifactPath = path.join(outputDirectory, artifact.fileName)
      await mkdir(path.dirname(artifactPath), { recursive: true })

      if (artifact.type === 'asset') {
        await writeFile(artifactPath, artifact.source)
      } else {
        await writeFile(artifactPath, artifact.code)

        if (artifact.isEntry) {
          entryPath = artifactPath
        }
      }
    }
  }

  if (entryPath === undefined) {
    throw new Error('Expected an entry chunk')
  }

  return entryPath
}

const buildAppModule = async (
  root: string,
  appModuleId: string,
  ssr: boolean,
  vueOptions?: VuePluginOptions,
): Promise<string> => {
  let captured: string | undefined

  await build({
    ...createConfig(
      root,
      ssr ? 'node' : 'browser',
      [
        createCapturePlugin(appModuleId, ssr, (code) => {
          captured = code
        }),
      ],
      vueOptions,
    ),
    build: ssr
      ? {
          minify: false,
          ssr: path.join(root, 'src/entry-server.ts'),
          write: false,
        }
      : {
          minify: false,
          rollupOptions: {
            input: path.join(root, 'index.html'),
          },
          write: false,
        },
  })

  if (captured === undefined) {
    throw new Error('Expected transformed App.vue module')
  }

  return captured
}

export const withVueProject = async <T>(
  options: VueProjectOptions,
  callback: (project: VueProject) => Promise<T>,
): Promise<T> => {
  const temporaryDirectory = await createTemporaryDirectory('cassiopeia-vite-')
  const root = temporaryDirectory.path
  const sourceDirectory = path.join(root, 'src')
  const appModuleId = path.join(sourceDirectory, 'App.vue')
  const serverEntryPath = path.join(sourceDirectory, 'entry-server.ts')
  const builtServerDirectory = path.join(root, 'dist-ssr')

  const withDevelopmentServer: VueProject['withDevelopmentServer'] = async (platform, callback) => {
    const server = await createServer(createConfig(root, platform, [], options.vueOptions))

    try {
      await server.listen(0)

      return await callback(server)
    } finally {
      await server.close()
    }
  }

  const project: VueProject = {
    appModuleId,
    cleanup: temporaryDirectory.cleanup,
    root,
    withDevelopmentServer,
    buildServerEntry: async () => {
      const result = await build({
        ...createConfig(root, 'node', [], options.vueOptions),
        build: {
          minify: false,
          ssr: serverEntryPath,
          write: false,
        },
      })

      return await writeOutputFiles(builtServerDirectory, result)
    },
    captureClientAppModule: async () =>
      await buildAppModule(root, appModuleId, false, options.vueOptions),
    captureServerAppModule: async () =>
      await buildAppModule(root, appModuleId, true, options.vueOptions),
    transformDevelopmentRequest: async (
      request = '/src/App.vue?vue&type=style&index=0&lang.css',
      transformOptions,
    ) => {
      const platform = transformOptions?.ssr === true ? 'node' : 'browser'

      return await withDevelopmentServer(platform, async (server) => {
        const result = await server.transformRequest(request, transformOptions)

        if (result?.code === undefined) {
          throw new Error(`Expected development transform for '${request}'`)
        }

        return result.code
      })
    },
    withDevelopmentServerEntry: async <Entry, Result>(
      callback: (entry: Entry) => Promise<Result>,
    ): Promise<Result> =>
      await withDevelopmentServer('node', async (server) => {
        const entry = (await server.ssrLoadModule('/src/entry-server.ts')) as Entry

        return await callback(entry)
      }),
  }

  try {
    await mkdir(sourceDirectory, { recursive: true })
    await writeFile(path.join(root, 'index.html'), createIndexHtml())
    await writeFile(path.join(sourceDirectory, 'App.vue'), options.appSource)
    await writeFile(path.join(sourceDirectory, 'main.ts'), createClientEntry())
    await writeFile(serverEntryPath, createServerEntry())

    for (const [relativePath, source] of Object.entries(options.extraFiles ?? {})) {
      const filePath = path.join(root, relativePath)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, source)
    }

    return await callback(project)
  } finally {
    await project.cleanup()
  }
}

export const extractRegisteredVariables = (code: string): string[] => {
  const match = /addMany\(\[(.*?)\]\)/s.exec(code)

  if (match === null) {
    return []
  }

  return match[1]
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length !== 0)
    .map((value) => value.replace(/^['"]|['"]$/g, ''))
}

export const importBuiltModule = async <T>(entryPath: string): Promise<T> => {
  const href = `${pathToFileURL(entryPath).href}?t=${Date.now()}`
  return (await import(href)) as T
}
