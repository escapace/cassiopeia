import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

const exampleDirectory = path.dirname(fileURLToPath(import.meta.url))

const templatePath = path.join(exampleDirectory, 'index.html')

const server = createHttpServer()

const vite = await createViteServer({
  appType: 'custom',
  configFile: path.join(exampleDirectory, 'vite.config.ts'),
  root: exampleDirectory,
  server: {
    allowedHosts: true,
    hmr: { server },
    middlewareMode: true,
  },
})

server.on('request', (request, response) => {
  vite.middlewares(request, response, async () => {
    try {
      const url = request.url ?? '/'
      const templateSource = await readFile(templatePath, 'utf8')
      const template = await vite.transformIndexHtml(url, templateSource)
      const { render } = await vite.ssrLoadModule('/src/entry-server.ts')
      const { appHtml, head } = await render()
      const html = template.replace('<!--app-head-->', head).replace('<!--app-html-->', appHtml)

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(html)
    } catch (error) {
      vite.ssrFixStacktrace(error)
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? (error.stack ?? error.message) : String(error))
    }
  })
})

server.listen(4173, () => {
  console.log('SSR development server: http://127.0.0.1:4173')
})
