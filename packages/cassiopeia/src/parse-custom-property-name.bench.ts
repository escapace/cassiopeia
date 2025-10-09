import { bench, describe } from 'vitest'
import { CustomPropertyGenerator } from '../src/test-support/custom-property-generator'
import { CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX } from './constants'
import { parseCustomPropertyName } from './parse-custom-property-name'

function isAscii(input: string): boolean {
  for (let index = 0; index < input.length; index++) {
    // ASCII range: 0x00–0x7F (0–127)
    if (input.charCodeAt(index) > 0x7f) return false
  }
  return true
}

const isCanonicalCustomProperty = (input: string) =>
  [
    input.match(CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX)?.length === 3,
    parseCustomPropertyName(input) !== undefined,
  ].every((value) => value)

const createData = (ascii: boolean, seed?: number, size = 256) => {
  let expectCanonical = true
  const set = new Set<string>()
  const generator = new CustomPropertyGenerator(seed)

  while (set.size !== size) {
    const value = expectCanonical
      ? generator.validCustomPropertyName()
      : generator.invalidCustomPropertyName()

    if (ascii && !isAscii(value)) {
      continue
    }

    if (isCanonicalCustomProperty(value) === expectCanonical) {
      if (set.has(value)) {
        continue
      }

      set.add(value)
      expectCanonical = !expectCanonical
    }
  }

  return Array.from(set)
}

function parseCustomPropertyNameRegex(input: string): [string, string] | undefined {
  const match = input.match(CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX)

  if (match?.length === 3) {
    return match.slice(1) as [string, string]
  }

  return undefined
}

const ASCII = createData(true)
const UNICODE = createData(false)

describe('custom property name parsing (ascii)', () => {
  bench(
    'regex-based parser',
    () => {
      for (const testCase of ASCII) {
        parseCustomPropertyNameRegex(testCase)
      }
    },
    {
      iterations: 20_000,
      warmupIterations: 100,
    },
  )

  bench(
    'hand-rolled parser',
    () => {
      for (const testCase of ASCII) {
        parseCustomPropertyName(testCase)
      }
    },
    {
      iterations: 20_000,
      warmupIterations: 100,
    },
  )
})

describe('custom property name parsing (unicode)', () => {
  bench(
    'regex-based parser',
    () => {
      for (const value of UNICODE) {
        parseCustomPropertyNameRegex(value)
      }
    },
    {
      iterations: 20_000,
      warmupIterations: 100,
    },
  )

  bench(
    'hand-rolled parser',
    () => {
      for (const value of UNICODE) {
        parseCustomPropertyName(value)
      }
    },
    {
      iterations: 20_000,
      warmupIterations: 100,
    },
  )
})
