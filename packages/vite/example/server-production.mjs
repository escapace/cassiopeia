import { createReadStream } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const exampleDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientDirectory = path.join(exampleDirectory, 'dist/client')
const serverEntryPath = path.join(exampleDirectory, 'dist/server/entry-server.js')
const templatePath = path.join(clientDirectory, 'index.html')

await Promise.all([
  access(templatePath),
  access(serverEntryPath),
]).catch(() => {
  throw new Error(
    [
      'Missing production build output for the example.',
      'Run these commands first from packages/vite:',
      './node_modules/.bin/vite build --config example/vite.config.ts',
      './node_modules/.bin/vite build --config example/vite.config.ts --ssr src/entry-server.ts',
    ].join('\n'),
  )
})

const { render } = await import(pathToFileURL(serverEntryPath).href)

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
])

const sendStaticFile = async (response, filePath) => {
  const extension = path.extname(filePath)
  const contentType = contentTypes.get(extension) ?? 'application/octet-stream'

  response.writeHead(200, { 'Content-Type': contentType })
  createReadStream(filePath).pipe(response)
}

const server = createHttpServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1:4174')
    const pathname = decodeURIComponent(url.pathname)
    const assetPath = path.join(clientDirectory, pathname.slice(1))

    if (pathname !== '/') {
      try {
        const assetStat = await stat(assetPath)

        if (assetStat.isFile()) {
          await sendStaticFile(response, assetPath)
          return
        }
      } catch {}
    }

    const template = await readFile(templatePath, 'utf8')
    const { appHtml, head } = await render()
    const html = template.replace('<!--app-head-->', head).replace('<!--app-html-->', appHtml)

    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(html)
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(error instanceof Error ? error.stack ?? error.message : String(error))
  }
})

server.listen(4173, () => {
  console.log('SSR production server: http://127.0.0.1:4173')
})
