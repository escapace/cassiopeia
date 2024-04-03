import { assert } from 'chai'
import { PLUGIN, REGEX } from './constants'
import { createCassiopeia, Iterator, Plugin, renderToString } from './index'
import { Variables } from './types'

export function* fromStrings(strings: string[]): Variables {
  for (const string of strings) {
    for (const match of string.matchAll(REGEX)) {
      const cancelled = yield match as unknown as [string, string, string]

      if (cancelled) {
        return
      }
    }
  }
}

function* createIterator(name: string, state: State): Iterator {
  const strings: string[] = []

  let cursor: true | string

  while ((cursor = yield) !== true) {
    state.i++

    const string = cursor.match(/^([a-zA-Z-0-9])+$/i)

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
    [PLUGIN]: (iterators: Map<string, () => Iterator>) => {
      iterators.set('abc', () => createIterator('abc', state))
      iterators.set('zxc', () => createIterator('zxc', state))
    }
  }

  return { state, plugin }
}

describe('./src/server.spec.ts', () => {
  it('.', () => {
    const { state, plugin } = createPlugin()
    const instance = createCassiopeia({
      plugins: [plugin]
    })

    // source: ,

    assert.equal(state.i, 0)
    assert.deepEqual(renderToString(instance), [])
    assert.equal(state.i, 0)

    void instance.update(() => fromStrings(['var(---abc-hello)']))

    assert.deepEqual(renderToString(instance), [
      { content: ':root { ---abc-hello: 2; }', name: 'abc', key: 0 }
    ])

    assert.deepEqual(renderToString(instance), [
      { content: ':root { ---abc-hello: 3; }', name: 'abc', key: 0 }
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
