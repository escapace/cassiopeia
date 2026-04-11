`@cassiopeia/vite` connects Cassiopeia to Vue single-file components in Vite. It detects Triple-dash CSS Custom Properties in Vue styles and wires the generated modules so `@cassiopeia/vue` can register and update them in browser and server-side rendering flows.

This package is for Vue projects that already use `cassiopeia` and `@cassiopeia/vue`.

## Install

```sh
pnpm add @cassiopeia/vite @cassiopeia/vue cassiopeia vue vite @vitejs/plugin-vue
```

## Use

```ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { cassiopeia } from '@cassiopeia/vite'

export default defineConfig({
  plugins: [cassiopeia(), vue()],
})
```

Install the Vue plugin in the app:

```ts
import { createApp } from 'vue'
import { createCassiopeia } from '@cassiopeia/vue'
import App from './App.vue'

const app = createApp(App)
app.use(createCassiopeia())
app.mount('#app')
```

## What it does

Given a Vue single-file component like this:

```vue
<template>
  <button class="button">ready</button>
</template>

<style>
.button {
  color: var(---theme-primary);
  border-color: var(---theme-secondary, red);
}
</style>
```

the plugin makes sure those Triple-dash CSS Custom Properties are registered through `@cassiopeia/vue`.

In development, the plugin keeps Vue style updates wired to Cassiopeia in the browser. In production, it updates the compiled Vue modules so the same Triple-dash CSS Custom Properties are registered for both client and server rendering.

## Example

A runnable example is included in `./example`.

See:

- `example/README.md`
- `example/vite.config.ts`
- `example/src/create-app.ts`
- `example/src/entry-server.ts`
