// import { parse } from '@babel/parser'
import { parseVueRequest } from '@vitejs/plugin-vue'
// import MagicString from 'magic-string'
import { type Plugin } from 'vite'

export interface VueQuery {
  vue: boolean
  type?: string
}

export const REGEX = /var\(---([a-zA-Z0-9]+)-([a-zA-Z-0-9]+)[),]/gm
// /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/.test(id)
// // /Users/mark/devel/cepheus/packages/app/src/components/home.vue?vue&type=style&index=0&scoped=3180c600&lang.css

interface State {
  files: Map<string, Set<string>>
}

// const map = new Map<string, Set<string>>()

const createPrePlugin = (state: State): Plugin => {
  return {
    name: '@cassiopeia/vite',
    enforce: 'pre',
    buildStart: {
      sequential: true,
      handler() {
        state.files.clear()
      }
    },
    transform: {
      handler(code, id) {
        // if (!id.includes('node_modules')) {
        const query = parseVueRequest(id)

        const set = new Set<string>()

        if (query.query.vue === true && query.query.type === 'style') {
          for (const match of code.matchAll(REGEX)) {
            set.add(['--', ...match.slice(1, 3)].join('-'))
          }

          if (set.size !== 0) {
            state.files.set(query.filename, set)
          }

          return
        }
        // }

        return code
      }
    }
  }
}

const createPostPlugin = (state: State): Plugin => ({
  name: '@cassiopeia/vite',
  enforce: 'post',
  transform: {
    handler(code, id) {
      const { filename } = parseVueRequest(id)

      if (state.files.has(filename)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const variables = state.files.get(filename)!

        code += `
import { useCassiopeia } from '@cassiopeia/vue'
import { getCurrentInstance } from 'vue'

console.log(getCurrentInstance())

//const cassiopeia = useCassiopeia()
//cassiopeia.add([${Array.from(variables)
          .map((value) => `'${value}'`)
          .join(', ')}])

//cassiopeia.update(false)
`
        return code
      }

      // if (
      //   state.files.has(filename) &&
      //   query.type === 'script' &&
      //   query.vue === true
      // ) {
      //   // const s = new MagicString(source)
      //   // const qwe = parse(s.original, {
      //   //   sourceFilename: query.filename,
      //   //   sourceType: 'module'
      //   // }).program
      // }

      // if (map.has(query.filename) && query.query.type === 'script') {
      //   console.log(id)
      // }

      // const set = new Set<string>()
      //
      // if (query.query.vue === true && query.query.type === 'style') {
      //   for (const match of code.matchAll(REGEX)) {
      //     set.add(['--', ...match.slice(1, 3)].join('-'))
      //   }
      //
      //   map.set(query.filename, set)
      //
      //   return
      // }
      // }

      return undefined
    }
  }
})

export const cassiopeia: () => Plugin[] = () => {
  const state: State = {
    files: new Map()
  }

  return [createPrePlugin(state), createPostPlugin(state)]
}
