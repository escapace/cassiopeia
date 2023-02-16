import { assert } from 'chai'
import { createCassiopeia, Iterator, Plugin, renderToString } from './index'
import { createSourceStrings } from './sources/strings'

const REGEX = /^([a-zA-Z-0-9])+$/i

function* createIterator(name: string, state: State): Iterator {
  const strings: string[] = []

  let cursor: true | string

  while ((cursor = yield) !== true) {
    state.i++

    const string = cursor.match(REGEX)

    if (string === null) {
      continue
    }

    strings.push(`---${name}-${cursor}: ${state.i};`)
  }

  if (strings.length === 0) {
    return
  }

  return { content: `:root { ${strings.join(' ')} }` }
}

interface State {
  i: number
}

const createPlugin = () => {
  const state: State = {
    i: 0
  }

  const plugin: Plugin = {
    plugin: (iterators: Map<string, () => Iterator>) => {
      const register = () => {
        iterators.set('abc', () => createIterator('abc', state))
        iterators.set('zxc', () => createIterator('zxc', state))
      }

      const deregister = () => {
        iterators.delete('abc')
        iterators.delete('zxc')
        state.i = 0
      }

      return { register, deregister }
    }
  }

  return { state, plugin }
}

describe('./src/server.spec.ts', () => {
  it('.', () => {
    const { state, plugin } = createPlugin()
    const instance = createCassiopeia({
      source: createSourceStrings(['var(---abc-hello)']),
      plugins: [plugin]
    })

    assert.equal(state.i, 0)
    assert.equal(renderToString(instance), undefined)
    assert.equal(state.i, 0)

    instance.start()
    assert.deepEqual(renderToString(instance), [
      { content: ':root { ---abc-hello: 2; }', key: 'abc' }
    ])

    assert.deepEqual(renderToString(instance), [
      { content: ':root { ---abc-hello: 3; }', key: 'abc' }
    ])

    // assert.equal(state.i, 0)
    //
    // assert.equal(
    //   renderToString(instance, 'var(---zxc-hello)'),
    //   '<style cassiopeia="id">:root { ---zxc-hello: 1; }</style>'
    // )
    //
    // assert.equal(
    //   renderToString(instance, 'var(---zxc-hello)'),
    //   '<style cassiopeia="id">:root { ---zxc-hello: 2; }</style>'
    // )
    //
    // assert.equal(
    //   renderToString(instance, 'var(---zxc-hello) var(---abc-hello)'),
    //   '<style cassiopeia="id">:root { ---zxc-hello: 3; }:root { ---abc-hello: 4; }</style>'
    // )
    //
    // instance.stop()
    // assert.equal(state.i, 0)
    //
    // assert.equal(renderToString(instance, 'var(---zxc-hello)'), undefined)
    //
    // instance.start()
    //
    // assert.equal(
    //   renderToString(instance, 'var(---abc-hello) var(---zxc-hello)'),
    //   '<style cassiopeia="id">:root { ---abc-hello: 1; }:root { ---zxc-hello: 2; }</style>'
    // )
  })
})
