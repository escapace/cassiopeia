import { describe, expect, it } from 'vitest'
import type { App } from 'vue'
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

describe('vite plugin end-user flows', () => {
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
        expect(code).toContain(
          '__cassiopeiaUpdateStyle(__vite__id, __vite__css, import.meta.hot.dispose.bind(import.meta.hot))',
        )
      },
    )
  })

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

        expect(code).toContain('import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"')
        expect(code).toContain("import _export_sfc from '")
        expect(code).toContain('const _sfc_setup_cassiopeia = _sfc_main.setup;')
        expect(code).toContain('if (__cassiopeia.addMany([')
        expect(extractRegisteredVariables(code)).toEqual(['---theme-primary', '---theme-secondary'])
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

        expect(code).toContain('import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"')
        expect(code).toContain("import _export_sfc from '")
        expect(extractRegisteredVariables(code)).toEqual(['---theme-primary', '---theme-secondary'])
      },
    )
  })

  it('ignores development transforms for non-style Vue module requests', async () => {
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
      },
    )
  })

  it('patches real client output captured from the Vue Vapor compiler toolchain', async () => {
    const result = await transformCompiledVueModule({
      compiledSource: vaporClientCompiledModule,
      sfcSource: vaporSfcSource,
    })

    expect(result.warnings).toEqual([])
    expect(result.code).toContain('import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"')
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
    expect(result.code).toContain('import { useCassiopeia as __useCassiopeia } from "@cassiopeia/vue"')
    expect(result.code).toContain('const __cassiopeia = __useCassiopeia();')
    expect(result.code).toContain(
      'if (__cassiopeia.addMany(["---theme-primary", "---theme-secondary"])) void __cassiopeia.update();',
    )
    expect(result.code).toContain('const ssrContext = __vite_useSSRContext()')
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
        expect(extractRegisteredVariables(code)).toEqual([])
      },
    )
  })

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
        expect(extractRegisteredVariables(transformedModule)).toEqual([
          '---theme-primary',
          '---theme-secondary',
        ])

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
