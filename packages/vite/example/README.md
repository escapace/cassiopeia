This example is a quick way to verify `@cassiopeia/vite` with Vue in browser and server-rendered flows. Run all commands from `packages/vite`.

There is no `package.json` in `example/`. It reuses the toolchain from this package.

If `packages/cassiopeia` or `packages/vue` changed and were not rebuilt yet, build them first.

## Browser development

```sh
pnpm exec vite --config example/vite.config.ts
```

Open `http://127.0.0.1:5173`.

Expected result: the card is styled, and devtools shows Cassiopeia-managed `<style>` tags.

## Server-side rendering development

```sh
node example/server-development.mjs
```

Open `http://127.0.0.1:4173`.

Quick check:

```sh
curl -s http://127.0.0.1:4173 | rg 'cassiopeia-key="theme"|--theme-primary|--theme-surface'
```

## Production build

```sh
pnpm exec vite build --config example/vite.config.ts
pnpm exec vite build --config example/vite.config.ts --ssr src/entry-server.ts
```

## Browser production preview

```sh
pnpm exec vite preview --config example/vite.config.ts --port 4175
```

Open `http://127.0.0.1:4175`.

## Server-side rendering production

```sh
node example/server-production.mjs
```

Open `http://127.0.0.1:4174`.

Quick check:

```sh
curl -s http://127.0.0.1:4174 | rg 'cassiopeia-key="theme"|--theme-primary|--theme-surface'
```

## Cleanup

```sh
rm -rf example/dist
```
