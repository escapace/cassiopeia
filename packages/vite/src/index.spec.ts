import { writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { App } from 'vue'
import * as compilerSFC from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import {
  extractRegisteredVariables,
  importBuiltModule,
  withVueProject,
} from './test-support/create-vite-fixture'
import { transformCompiledVueModule } from './test-support/create-plugin-transform-fixture'
import {
  vaporClientCompiledModule,
  vaporSfcSource,
  vaporSsrCompiledModule,
} from './test-support/vue-vapor-fixtures'

interface BuiltServerModule {
  createServerApp: () => {
    app: App
    cassiopeia: {
      dispose: () => Promise<void>
      update: () => Promise<void>
    }
  }
  readRegistrations: () => string[][]
  readStyles: (cassiopeia: unknown) => unknown
  readUpdateCount: () => number
}

const flushScheduler = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
  await Promise.resolve()
}

const expectRegisteredVariables = (code: string, variables: string[]) => {
  expect(extractRegisteredVariables(code)).toEqual(variables)
}

const expectUseCassiopeiaImport = (code: string) => {
  expect(code).toContain('useCassiopeia')
}

const expectVueSSRModuleTracking = (code: string) => {
  expect(code).toContain('ssrContext.modules')
}

describe('vite plugin end-user flows', () => {
  describe('development client style modules', () => {
    it('injects updateStyle into development style modules generated from real Vue SFCs', async () => {
      await withVueProject(
        {
          appSource: `
<template>
  <button class="button">dev ready</button>
</template>

<style>
.button {
  color: var(---theme-primary);
  border-color: var(---theme-secondary, red);
}
</style>
`,
        },
        async ({ transformDevelopmentRequest }) => {
          const code = await transformDevelopmentRequest()

          expect(code).toContain('updateStyle as __cassiopeiaUpdateStyle')
          expect(code).toContain('if (disposed) return;')
          expect(code).toContain('import.meta.hot.dispose(dispose);')
          expect(code).toContain('import.meta.hot.prune(dispose);')
          expect(code).toContain(
            '__cassiopeiaUpdateStyle(__vite__id, __vite__css, __cassiopeiaDisposeStyle)',
          )
        },
      )
    })

    it('leaves development client main modules to the style-module HMR path', async () => {
      await withVueProject(
        {
          appSource: `
<template>
  <button class="button">module request</button>
</template>

<style>
.button {
  color: var(---theme-primary);
}
</style>
`,
        },
        async ({ transformDevelopmentRequest }) => {
          const code = await transformDevelopmentRequest('/src/App.vue')

          expect(code).not.toContain('__cassiopeiaUpdateStyle')
          expect(code).not.toContain('__useCassiopeia')
          expectRegisteredVariables(code, [])
        },
      )
    })
  })

  describe('development SSR compiled modules', () => {
    it('injects registration into development SSR modules generated from real Vue SFCs', async () => {
      await withVueProject(
        {
          appSource: `
<script setup>
const label = 'development server ready'
</script>

<template>
  <button class="button">{{ label }}</button>
</template>

<style>
.button {
  color: var(---theme-primary);
  border-color: var(---theme-secondary, red);
}
</style>
`,
        },
        async ({ transformDevelopmentRequest }) => {
          const code = await transformDevelopmentRequest('/src/App.vue', { ssr: true })

          expectUseCassiopeiaImport(code)
          expect(code).toContain('const __cassiopeia =')
          expectVueSSRModuleTracking(code)
          expectRegisteredVariables(code, ['---theme-primary', '---theme-secondary'])
        },
      )
    })

    it('supports custom dev server-consumer environments without relying on the deprecated ssr hook flag', async () => {
      const resolvedImportSource = '/@fs/project/node_modules/@cassiopeia/vue/index.js'
      const result = await transformCompiledVueModule({
        compiledSource: vaporSsrCompiledModule,
        consumer: 'server',
        environmentMode: 'dev',
        resolvedImportSource,
        sfcSource: vaporSfcSource,
      })

      expect(result.warnings).toEqual([])
      expect(result.code).toContain(
        `import { useCassiopeia as __useCassiopeia } from ${JSON.stringify(resolvedImportSource)}`,
      )
      expectRegisteredVariables(result.code ?? '', ['---theme-primary', '---theme-secondary'])
    })

    it('clears development SSR scan metadata when SFC styles no longer contain variables', async () => {
      await withVueProject(
        {
          appSource: `
<template>
  <button class="button">rescan</button>
</template>

<style>
.button {
  color: var(---theme-primary);
}
</style>
`,
        },
        async ({ appModuleId, withDevelopmentServer }) => {
          await withDevelopmentServer('node', async (server) => {
            const first = await server.transformRequest('/src/App.vue', { ssr: true })

            expectRegisteredVariables(first?.code ?? '', ['---theme-primary'])

            await writeFile(
              appModuleId,
              `
<template>
  <button class="button">rescan</button>
</template>

<style>
.button {
  color: red;
}
</style>
`,
            )
            server.moduleGraph.invalidateAll()

            const second = await server.transformRequest('/src/App.vue', { ssr: true })

            expect(second?.code).not.toContain('__useCassiopeia')
            expectRegisteredVariables(second?.code ?? '', [])
          })
        },
      )
    })

    it('registers variables during development SSR renders and preserves Vue module tracking', async () => {
      await withVueProject(
        {
          appSource: `
<script setup>
const label = 'development server render'
</script>

<template>
  <button class="button">{{ label }}</button>
</template>

<style src="./theme.css"></style>
`,
          extraFiles: {
            'src/theme.css': `
.button {
  color: var(---theme-primary);
  border-color: var(---theme-secondary, red);
}
`,
          },
        },
        async ({ withDevelopmentServerEntry }) => {
          await withDevelopmentServerEntry(async (entry: BuiltServerModule) => {
            const { app, cassiopeia } = entry.createServerApp()
            const context: { modules?: Set<string> } = {}

            try {
              const html = await renderToString(app, context)
              await flushScheduler()

              expect(html).toContain('development server render')
              expect(Array.from(context.modules ?? [])).toContain('src/App.vue')
              expect(entry.readRegistrations()).toEqual([[
                '---theme-primary',
                '---theme-secondary',
              ]])
              expect(entry.readUpdateCount()).toBe(1)
            } finally {
              await cassiopeia.dispose()
            }
          })
        },
      )
    })
  })

  describe('build client compiled modules', () => {
    it('injects client-side registration for classic SFC output compiled from .vue input', async () => {
      await withVueProject(
        {
          appSource: `
<template>
  <button class="button">classic</button>
</template>

<style>
.button {
  color: var(---theme-primary);
  border-color: var(---theme-secondary, red);
}
</style>
`,
        },
        async ({ captureClientAppModule }) => {
          const code = await captureClientAppModule()

          expect(code).toContain(
            'import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"',
          )
          expect(code).toContain("import _export_sfc from '")
          expect(code).toContain('const _sfc_setup_cassiopeia = _sfc_main.setup;')
          expect(code).toContain('if (__cassiopeia.addMany([')
          expectRegisteredVariables(code, ['---theme-primary', '---theme-secondary'])
        },
      )
    })

    it('uses the Vue plugin compiler parser when scanning production SFC styles', async () => {
      await withVueProject(
        {
          appSource: `
<template>
  <button class="button">custom parser</button>
</template>

<style>
.button {
  color: red;
}
</style>
`,
          vueOptions: {
            compiler: {
              ...compilerSFC,
              parse(source, options) {
                const rewrittenSource = source.replace(
                  'color: red;',
                  'color: var(---theme-from-custom-parser);',
                )

                return compilerSFC.parse(rewrittenSource, options)
              },
            },
          },
        },
        async ({ captureClientAppModule }) => {
          const code = await captureClientAppModule()

          expectRegisteredVariables(code, ['---theme-from-custom-parser'])
        },
      )
    })

    it('deduplicates variables gathered from external and inline styles in script setup SFCs', async () => {
      await withVueProject(
        {
          appSource: `
<script setup>
const label = 'script setup'
</script>

<template>
  <button class="button">{{ label }}</button>
</template>

<style src="./theme.css"></style>
<style>
.button {
  color: var(---theme-primary);
}
</style>
`,
          extraFiles: {
            'src/theme.css': `
.button {
  color: var(---theme-primary);
  border-color: var(---theme-secondary, red);
}
`,
          },
        },
        async ({ captureClientAppModule }) => {
          const code = await captureClientAppModule()

          expect(code).toContain(
            'import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"',
          )
          expect(code).toContain("import _export_sfc from '")
          expectRegisteredVariables(code, ['---theme-primary', '---theme-secondary'])
        },
      )
    })

    it('leaves SFCs without Cassiopeia variables untouched', async () => {
      await withVueProject(
        {
          appSource: `
<template>
  <button class="button">plain css</button>
</template>

<style>
.button {
  color: red;
  border-color: blue;
}
</style>
`,
        },
        async ({ captureClientAppModule }) => {
          const code = await captureClientAppModule()

          expect(code).not.toContain('__useCassiopeia')
          expectRegisteredVariables(code, [])
        },
      )
    })
  })

  describe('compiled Vue Vapor output', () => {
    it('patches real client output captured from the Vue Vapor compiler toolchain', async () => {
      const result = await transformCompiledVueModule({
        compiledSource: vaporClientCompiledModule,
        sfcSource: vaporSfcSource,
      })

      expect(result.warnings).toEqual([])
      expect(result.code).toContain(
        'import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"',
      )
      expect(result.code).toContain('const _sfc_setup_cassiopeia = _sfc_main.setup;')
      expect(result.code).toContain(
        'if (__cassiopeia.addMany(["---theme-primary", "---theme-secondary"])) void __cassiopeia.update();',
      )
      expect(result.code).toContain("const label='hello'")
    })

    it('patches real SSR output captured from the Vue Vapor compiler toolchain', async () => {
      const result = await transformCompiledVueModule({
        compiledSource: vaporSsrCompiledModule,
        sfcSource: vaporSfcSource,
        ssr: true,
      })

      expect(result.warnings).toEqual([])
      expect(result.code).toContain(
        'import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"',
      )
      expect(result.code).toContain('const __cassiopeia = __useCassiopeia();')
      expect(result.code).toContain(
        'if (__cassiopeia.addMany(["---theme-primary", "---theme-secondary"])) void __cassiopeia.update();',
      )
      expect(result.code).toContain('const ssrContext = __vite_useSSRContext()')
    })
  })

  describe('build SSR compiled modules', () => {
    it('registers variables during SSR renders, preserves Vue module tracking, and keeps request-scoped styles available for explicit flushing', async () => {
      await withVueProject(
        {
          appSource: `
<script setup>
const label = 'server ready'
</script>

<template>
  <button class="button">{{ label }}</button>
</template>

<style src="./theme.css"></style>
`,
          extraFiles: {
            'src/theme.css': `
.button {
  color: var(---theme-primary);
  border-color: var(---theme-secondary, red);
}
`,
          },
        },
        async ({ buildServerEntry, captureServerAppModule }) => {
          const transformedModule = await captureServerAppModule()

          expect(transformedModule).toContain(
            'import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"',
          )
          expect(transformedModule).toContain('const ssrContext = __vite_useSSRContext()')
          expectRegisteredVariables(transformedModule, ['---theme-primary', '---theme-secondary'])

          const entryPath = await buildServerEntry()
          const entry = await importBuiltModule<BuiltServerModule>(entryPath)
          const { app, cassiopeia } = entry.createServerApp()
          const context: { modules?: Set<string> } = {}

          try {
            const html = await renderToString(app, context)
            await flushScheduler()

            expect(html).toContain('server ready')
            expect(Array.from(context.modules ?? [])).toContain('src/App.vue')
            expect(entry.readRegistrations()).toEqual([['---theme-primary', '---theme-secondary']])
            expect(entry.readUpdateCount()).toBe(1)

            await cassiopeia.update()

            expect(entry.readStyles(cassiopeia)).toEqual([
              {
                content: ':root { --theme-primary: 1; --theme-secondary: 2; }',
                index: 0,
                key: 'theme',
              },
            ])
          } finally {
            await cassiopeia.dispose()
          }
        },
      )
    })
  })
})
