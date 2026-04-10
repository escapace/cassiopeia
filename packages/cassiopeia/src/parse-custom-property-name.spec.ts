import { assert, describe, expect, it } from 'vitest'
import {
  CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX,
  CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX,
} from './constants'
import { parseCustomPropertyName } from './parse-custom-property-name'
import { CustomPropertyGenerator } from './test-support/custom-property-generator'

describe('parseCustomPropertyName - Unit Tests', () => {
  it('parses basic valid inputs', () => {
    expect(parseCustomPropertyName('---color-primary')).toEqual(['color', 'primary'])
    expect(parseCustomPropertyName('---font-size')).toEqual(['font', 'size'])
    expect(parseCustomPropertyName('---z-index')).toEqual(['z', 'index'])
    expect(parseCustomPropertyName('---color-3-25-1')).toEqual(['color', '3-25-1'])
    expect(parseCustomPropertyName('---co\\-lor-3-25-1')).toEqual(['co-lor', '3-25-1'])
    expect(parseCustomPropertyName('----color-3-25-1')).not.toBeDefined()
    expect(parseCustomPropertyName('---co-lor-3-25-1')).toEqual(['co', 'lor-3-25-1'])
  })

  it('handles underscores', () => {
    expect(parseCustomPropertyName('---_color-primary')).toEqual(['_color', 'primary'])
    expect(parseCustomPropertyName('---my_var-my_val')).toEqual(['my_var', 'my_val'])
    expect(parseCustomPropertyName('---_private-_value')).toEqual(['_private', '_value'])
  })

  it('handles non-ASCII characters', () => {
    expect(parseCustomPropertyName('---café-latté')).toEqual(['café', 'latté'])
    expect(parseCustomPropertyName('---日本語-値')).toEqual(['日本語', '値'])
    expect(parseCustomPropertyName('---ñame-valøe')).toEqual(['ñame', 'valøe'])
  })

  it('handles various foreign language scripts', () => {
    expect(parseCustomPropertyName('---Привет-Мир')).toEqual(['Привет', 'Мир'])
    expect(parseCustomPropertyName('---مرحبا-عالم')).toEqual(['مرحبا', 'عالم'])
    expect(parseCustomPropertyName('---שלום-עולם')).toEqual(['שלום', 'עולם'])
    expect(parseCustomPropertyName('---안녕하세요-세계')).toEqual(['안녕하세요', '세계'])
    expect(parseCustomPropertyName('---สวัสดี-โลก')).toEqual(['สวัสดี', 'โลก'])
    expect(parseCustomPropertyName('---Γεια-κόσμος')).toEqual(['Γεια', 'κόσμος'])
    expect(parseCustomPropertyName('---हैलो-दुनिया')).toEqual(['हैलो', 'दुनिया'])
  })

  it('allows escaped hyphens in KEY segment', () => {
    expect(parseCustomPropertyName('---my\\2d key-value')).toEqual(['my-key', 'value'])
    expect(parseCustomPropertyName('---my\\-key-value')).toEqual(['my-key', 'value'])
    expect(parseCustomPropertyName('---a\\2d b\\2d c-suffix')).toEqual(['a-b-c', 'suffix'])
    expect(parseCustomPropertyName('---\\2d leading-suffix')).toEqual(['-leading', 'suffix'])
    expect(parseCustomPropertyName('---trailing\\2d -suffix')).toEqual(['trailing-', 'suffix'])
  })

  it('handles surrogate pairs (supplementary plane characters)', () => {
    expect(parseCustomPropertyName('---𝔸-𝔹')).toEqual(['𝔸', '𝔹'])
    expect(parseCustomPropertyName('---test𝔸-value𝔹')).toEqual(['test𝔸', 'value𝔹'])
    expect(parseCustomPropertyName('---😀-😎')).toEqual(['😀', '😎'])
    expect(parseCustomPropertyName('---𠀀-𪛖')).toEqual(['𠀀', '𪛖'])
  })

  it('handles hex escape sequences', () => {
    expect(parseCustomPropertyName('---\\63 olor-primary')).toEqual(['color', 'primary'])
    expect(parseCustomPropertyName('---c\\6f lor-primary')).toEqual(['color', 'primary'])
    expect(parseCustomPropertyName('---color-\\70 rimary')).toEqual(['color', 'primary'])
    expect(parseCustomPropertyName('---\\63\\6f\\6c\\6f\\72-value')).toEqual(['color', 'value'])
  })

  it('handles hex escape termination with space', () => {
    expect(parseCustomPropertyName('---\\26 B-color')).toEqual(['&B', 'color'])
    expect(parseCustomPropertyName('---A\\26 B-color')).toEqual(['A&B', 'color'])
    expect(parseCustomPropertyName('---color-\\26 B')).toEqual(['color', '&B'])
    expect(parseCustomPropertyName('---\\26 \\26 -test')).toEqual(['&&', 'test'])
  })

  it('handles hex escape with exactly 6 digits (no space needed)', () => {
    expect(parseCustomPropertyName('---\\000026B-color')).toEqual(['&B', 'color'])
    expect(parseCustomPropertyName('---A\\000026B-color')).toEqual(['A&B', 'color'])
    expect(parseCustomPropertyName('---color-\\000026B')).toEqual(['color', '&B'])
    expect(parseCustomPropertyName('---\\000041\\000042-\\000043')).toEqual(['AB', 'C'])
    expect(parseCustomPropertyName('---\\00006fk-test')).toEqual(['ok', 'test'])
  })

  it('handles hex escape termination with tab', () => {
    expect(parseCustomPropertyName('---\\26\tB-color')).toEqual(['&B', 'color'])
    expect(parseCustomPropertyName('---A\\26\tB-color')).toEqual(['A&B', 'color'])
    expect(parseCustomPropertyName('---color-\\26\tB')).toEqual(['color', '&B'])
  })

  it('rejects hex escape followed by CR/LF (not supported for property names)', () => {
    expect(parseCustomPropertyName('---\\26\r\nB-color')).toBeUndefined()
    expect(parseCustomPropertyName('---A\\26\r\nB-color')).toBeUndefined()
    expect(parseCustomPropertyName('---color-\\26\r\nB')).toBeUndefined()
  })

  it('rejects hex escape followed by LF (not supported for property names)', () => {
    expect(parseCustomPropertyName('---\\26\nB-color')).toBeUndefined()
    expect(parseCustomPropertyName('---A\\26\nB-color')).toBeUndefined()
    expect(parseCustomPropertyName('---color-\\26\nB')).toBeUndefined()
  })

  it('handles simple escape sequences', () => {
    expect(parseCustomPropertyName('---c\\olor-primary')).toEqual(['color', 'primary'])
    expect(parseCustomPropertyName('---my\\2dkey-value')).toEqual(['my-key', 'value'])
  })

  it('allows escaped hyphens in KEY segment (hex and simple escapes)', () => {
    expect(parseCustomPropertyName('---my\\2d key-value')).toEqual(['my-key', 'value'])
    expect(parseCustomPropertyName('---my\\-key-value')).toEqual(['my-key', 'value'])
    expect(parseCustomPropertyName('---a\\2d b\\2d c-suffix')).toEqual(['a-b-c', 'suffix'])
    expect(parseCustomPropertyName('---\\2d leading-suffix')).toEqual(['-leading', 'suffix'])
    expect(parseCustomPropertyName('---trailing\\2d -suffix')).toEqual(['trailing-', 'suffix'])
  })

  it('handles special characters via escape sequences', () => {
    expect(parseCustomPropertyName('---B\\26 W-color')).toEqual(['B&W', 'color'])
    expect(parseCustomPropertyName('---B\\&W-color')).toEqual(['B&W', 'color'])
    expect(parseCustomPropertyName('---color-B\\26 W')).toEqual(['color', 'B&W'])
    expect(parseCustomPropertyName('---B\\3f W-color')).toEqual(['B?W', 'color'])
    expect(parseCustomPropertyName('---B\\?W-color')).toEqual(['B?W', 'color'])
    expect(parseCustomPropertyName('---B\\26 W\\3f -color')).toEqual(['B&W?', 'color'])
  })

  it('handles emoji in custom property names', () => {
    expect(parseCustomPropertyName('---😺-color')).toEqual(['😺', 'color'])
    expect(parseCustomPropertyName('---cat-😺')).toEqual(['cat', '😺'])
    expect(parseCustomPropertyName('---🎨-theme')).toEqual(['🎨', 'theme'])
    expect(parseCustomPropertyName('---theme-🎨')).toEqual(['theme', '🎨'])
  })

  it('allows hyphens in SUFFIX but not KEY', () => {
    expect(parseCustomPropertyName('---color-primary-dark')).toEqual(['color', 'primary-dark'])
    expect(parseCustomPropertyName('---btn-bg-hover-active')).toEqual(['btn', 'bg-hover-active'])
    expect(parseCustomPropertyName('---a-b-c-d-e-f')).toEqual(['a', 'b-c-d-e-f'])
  })

  it('rejects invalid prefix', () => {
    expect(parseCustomPropertyName('--color-primary')).toBeUndefined()
    expect(parseCustomPropertyName('----color-primary')).toBeUndefined()
    expect(parseCustomPropertyName('color-primary')).toBeUndefined()
  })

  it('rejects missing parts', () => {
    expect(parseCustomPropertyName('---')).toBeUndefined()
    expect(parseCustomPropertyName('---color')).toBeUndefined()
    expect(parseCustomPropertyName('---color-')).toBeUndefined()
  })

  it('allows digits at start of identifiers', () => {
    expect(parseCustomPropertyName('---0border-radius')).toEqual(['0border', 'radius'])
    expect(parseCustomPropertyName('---color-0value')).toEqual(['color', '0value'])
    expect(parseCustomPropertyName('---9test-value')).toEqual(['9test', 'value'])
  })

  it('rejects invalid characters', () => {
    expect(parseCustomPropertyName('--- color-primary')).toBeUndefined()
    expect(parseCustomPropertyName('---color- primary')).toBeUndefined()
    expect(parseCustomPropertyName('---color-primary ')).toBeUndefined()
    expect(parseCustomPropertyName('---color@-value')).toBeUndefined()
    expect(parseCustomPropertyName('---color!-value')).toBeUndefined()
  })

  it('is case-sensitive', () => {
    const result1 = parseCustomPropertyName('---Color-Primary')
    const result2 = parseCustomPropertyName('---color-primary')
    expect(result1).toEqual(['Color', 'Primary'])
    expect(result2).toEqual(['color', 'primary'])
    expect(result1).not.toEqual(result2)
  })

  it('requires exact match (anchored)', () => {
    expect(parseCustomPropertyName('---color-primary-extra')).toEqual(['color', 'primary-extra'])
    expect(parseCustomPropertyName('prefix---color-primary')).toBeUndefined()
  })
})

describe('parseCustomPropertyName - Property-Based Tests', () => {
  const ITERATIONS = 3000

  it('always parses generated valid inputs', () => {
    for (let index = 0; index < ITERATIONS; index++) {
      const gen = new CustomPropertyGenerator(42 + index)
      const input = gen.validCustomPropertyName()
      const result = parseCustomPropertyName(input)

      expect(result).toBeDefined()
      expect(result).toHaveLength(2)
      expect(typeof result![0]).toBe('string')
      expect(typeof result![1]).toBe('string')
      expect(result![0].length).toBeGreaterThan(0)
      expect(result![1].length).toBeGreaterThan(0)
    }
  })

  it('KEY never contains unescaped hyphens', () => {
    for (let index = 0; index < ITERATIONS; index++) {
      const gen = new CustomPropertyGenerator(1000 + index)
      const input = gen.validCustomPropertyName()
      const result = parseCustomPropertyName(input)

      expect(result).toBeDefined()
      const [key] = result!
      expect(key.includes('-')).toBe(false)
    }
  })

  it('SUFFIX can contain hyphens', () => {
    const inputs = ['---a-b-c', '---test-multi-word-value', '---x-y-z-w']

    for (const input of inputs) {
      const result = parseCustomPropertyName(input)
      expect(result).toBeDefined()
      expect(result![1].includes('-')).toBe(true)
    }
  })

  it('concatenating KEY, separator, and SUFFIX with prefix reconstructs valid input structure', () => {
    for (let index = 0; index < ITERATIONS; index++) {
      const gen = new CustomPropertyGenerator(2000 + index)
      const input = gen.validCustomPropertyName()
      const result = parseCustomPropertyName(input)

      expect(result).toBeDefined()
      const [key, suffix] = result!
      expect(input.startsWith('---')).toBe(true)
      expect(key.length).toBeGreaterThan(0)
      expect(suffix.length).toBeGreaterThan(0)
    }
  })

  it('rejects inputs shorter than minimum length', () => {
    const shortInputs = ['', '---', '----', '-----', '---a-', '---a']

    for (const input of shortInputs) {
      const result = parseCustomPropertyName(input)
      const shouldBeRejected = input.length < 6 || /^---[a-z_\u0080-\uFFFF]/i.exec(input) === null
      expect(shouldBeRejected).toBe(true)
      expect(result).toBeUndefined()
    }
  })

  it('rejects all generated invalid inputs', () => {
    for (let index = 0; index < ITERATIONS; index++) {
      const gen = new CustomPropertyGenerator(3000 + index)
      const input = gen.invalidCustomPropertyName()
      const result = parseCustomPropertyName(input)

      expect(result).toBeUndefined()
    }
  })

  it('escape sequences are properly decoded to Unicode', () => {
    const testCases = [
      { expectedKey: 'color', input: '---\\63 olor-primary' },
      { expectedKey: 'ABC', input: '---\\41 BC-test' },
      { expectedSuffix: 'value', input: '---test-\\76 alue' },
      { expectedKey: 'my-test', input: '---my\\2d test-value' },
    ]

    for (const { expectedKey, expectedSuffix, input } of testCases) {
      const result = parseCustomPropertyName(input)
      expect(result).toBeDefined()
      const parsed = result!
      if (expectedKey !== undefined) {
        assert.equal(parsed[0], expectedKey)
      }
      if (expectedSuffix !== undefined) {
        assert.equal(parsed[1], expectedSuffix)
      }
    }
  })

  it('handles mixed escaped and unescaped characters', () => {
    for (let index = 0; index < 100; index++) {
      const gen = new CustomPropertyGenerator(4000 + index)

      const key = gen.validKey(3, 8)
      const suffix = gen.validSuffix(3, 8)
      const input = `---${key}-${suffix}`

      const result = parseCustomPropertyName(input)

      expect(result).toBeDefined()
      expect(result).toHaveLength(2)
    }
  })

  it('preserves non-ASCII characters', () => {
    const nonAsciiChars = ['é', 'ñ', 'ü', 'ø', '日', '本', '語', 'א', 'ב']

    for (let index = 0; index < nonAsciiChars.length; index++) {
      const char = nonAsciiChars[index]
      const input = `---${char}test-value`
      const result = parseCustomPropertyName(input)

      expect(result).toBeDefined()
      expect(result![0].startsWith(char)).toBe(true)
    }
  })

  it('maintains idempotency (parsing twice yields same result)', () => {
    for (let index = 0; index < 100; index++) {
      const gen = new CustomPropertyGenerator(5000 + index)
      const input = gen.validCustomPropertyName()

      const result1 = parseCustomPropertyName(input)
      const result2 = parseCustomPropertyName(input)

      expect(result1).toEqual(result2)
    }
  })

  it('handles boundary conditions for identifier lengths', () => {
    expect(parseCustomPropertyName('---a-b')).toEqual(['a', 'b'])

    const longKey = 'a'.repeat(100)
    const longSuffix = 'b'.repeat(100)
    const longInput = `---${longKey}-${longSuffix}`
    const result = parseCustomPropertyName(longInput)
    expect(result).toBeDefined()
    expect(result![0]).toBe(longKey)
    expect(result![1]).toBe(longSuffix)
  })

  it('correctly handles trailing whitespace after hex escapes', () => {
    expect(parseCustomPropertyName('---\\63 olor-test')).toEqual(['color', 'test'])
    expect(parseCustomPropertyName('---\\63\tolor-test')).toEqual(['color', 'test'])
    expect(parseCustomPropertyName('---test-\\76 alue')).toEqual(['test', 'value'])
  })

  it('rejects invalid escape sequences', () => {
    expect(parseCustomPropertyName('---test\\-value')).toBeUndefined()
    expect(parseCustomPropertyName('---color-test\\')).toBeUndefined()
  })

  it('rejects out-of-range hex escapes', () => {
    expect(parseCustomPropertyName('---\\110000-value')).toBeUndefined()
    expect(parseCustomPropertyName('---\\FFFFFF-value')).toBeUndefined()
    expect(parseCustomPropertyName('---test-\\999999')).toBeUndefined()
  })

  it('rejects explicit invalid test cases', () => {
    const invalidTestCases = [
      // Wrong prefix
      '--color-primary',
      '----color-primary',
      'color-primary',

      // Missing parts
      '---',
      '---color',
      '---color-',

      // Invalid characters
      '--- color-primary',
      '---color- primary',
      '---color-primary ',
      '---color@-value',
      '---color!-value',

      // SUFFIX starting with hyphen
      '----value',

      // Invalid escapes
      '---test\\-value',
      '---color-test\\',

      // Newlines after escapes
      '---\\26\r\nB-color',
      '---\\26\nB-color',

      '----color-3-25-1',
    ]

    for (const input of invalidTestCases) {
      expect(parseCustomPropertyName(input)).toBeUndefined()
    }
  })
})

/**
 * Decodes CSS escape sequences in a string to match parser output. Handles hex escapesand simple
 * escapes. Leaves out-of-range hex escapes undecoded (parser will reject them).
 */
function decodeEscapes(input: string): string {
  return input.replace(/\\([0-9A-F]{1,6})[ \t]?|\\([^\r\n\f])/gi, (match, hex, simple: string) => {
    if (typeof hex === 'string') {
      const codePoint = parseInt(hex, 16)
      if (codePoint > 0x10_ff_ff) return match
      return String.fromCodePoint(codePoint)
    }

    return simple
  })
}

/**
 * Parses input using the Unicode regex and decodes escape sequences in captures.
 */
function parseWithRegex(input: string): [string, string] | undefined {
  const match = input.match(CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX)
  if (match?.length !== 3) return undefined
  return [decodeEscapes(match[1]), decodeEscapes(match[2])]
}

describe('parseCustomPropertyName vs CASSIOPEIA_CUSTOM_PROPERTY_NAME_UNICODE_REGEX', () => {
  const testCases = [
    // Basic ASCII
    '---color-primary',
    '---font-size',
    '---a-b',
    '---test123-value456',

    // Underscores
    '---_color-primary',
    '---my_var-my_val',

    // Non-ASCII
    '---café-latté',
    '---日本語-値',
    '---Привет-Мир',
    '---שלום-עולם',

    // Surrogate pairs
    '---𝔸-𝔹',
    '---😀-😎',
    '---test𝔸-value𝔹',

    // Hex escapes
    '---\\63 olor-primary',
    '---c\\6f lor-primary',
    '---\\63\\6f\\6c\\6f\\72-value',
    '---\\000026B-color',
    '---\\00006fk-test',

    // Hex escapes with tab
    '---\\26\tB-color',
    '---A\\26\tB-color',

    // Simple escapes
    '---c\\olor-primary',
    '---my\\2dkey-value',

    // Escaped hyphens in KEY
    '---my\\2d key-value',
    '---my\\-key-value',
    '---a\\2d b\\2d c-suffix',
    '---\\2d leading-suffix',
    '---trailing\\2d -suffix',

    // Special chars via escapes
    '---B\\26 W-color',
    '---B\\&W-color',
    '---B\\3f W-color',

    // Hyphens in SUFFIX
    '---color-primary-dark',
    '---btn-bg-hover-active',
    '---a-b-c-d-e-f',

    // Mixed escaped and unescaped
    '---test-multi-word-value',
    '---color-\\26 test',

    // Digits at start
    '---0border-radius',
    '---9test-value',

    '---co\\-lor-3-25-1',
    '---co-lor-3-25-1',

    // Long identifiers
    `---${'a'.repeat(50)}-${'b'.repeat(50)}`,
  ]

  it('produces identical results for valid inputs', () => {
    for (const input of testCases) {
      const parserResult = parseCustomPropertyName(input)
      const regexResult = parseWithRegex(input)

      expect(regexResult).toEqual(parserResult)
    }
  })

  it('regex never rejects what parser accepts (critical property)', () => {
    for (const input of testCases) {
      const parserResult = parseCustomPropertyName(input)
      const regexResult = parseWithRegex(input)

      // If parser accepts, regex MUST also accept
      if (parserResult === undefined) {
        continue
      }

      expect(regexResult).toBeDefined()
      expect(regexResult).toEqual(parserResult)
    }
  })

  it('regex output feeds parser correctly for all property-based valid inputs', () => {
    // Reuse the same test generation from property-based tests
    const ITERATIONS = 1000

    for (let index = 0; index < ITERATIONS; index++) {
      const gen = new CustomPropertyGenerator(42 + index)
      const input = gen.validCustomPropertyName()

      // Step 1: Regex matches and decodes
      const regexResult = parseWithRegex(input)
      expect(regexResult).toBeDefined()

      // Step 2: Feed decoded result to parser for validation
      const [key, suffix] = regexResult!
      const reconstructed = `---${key}-${suffix}`
      const parserValidation = parseCustomPropertyName(reconstructed)

      // Parser must accept regex output for valid inputs
      expect(parserValidation).toBeDefined()
      expect(parserValidation).toEqual([key, suffix])

      // Step 3: Original parser result should match
      const parserResult = parseCustomPropertyName(input)
      expect(parserResult).toBeDefined()
      expect(regexResult).toEqual(parserResult)
    }
  })

  it('regex output feeds parser correctly for mixed escaped/unescaped inputs', () => {
    for (let index = 0; index < 100; index++) {
      const gen = new CustomPropertyGenerator(4000 + index)

      const key = gen.validKey(3, 8)
      const suffix = gen.validSuffix(3, 8)
      const input = `---${key}-${suffix}`

      // Regex matches and decodes
      const regexResult = parseWithRegex(input)
      expect(regexResult).toBeDefined()

      // Feed to parser
      const [decodedKey, decodedSuffix] = regexResult!
      const reconstructed = `---${decodedKey}-${decodedSuffix}`
      const parserValidation = parseCustomPropertyName(reconstructed)

      expect(parserValidation).toBeDefined()
      expect(parserValidation).toEqual([decodedKey, decodedSuffix])

      // Verify against direct parsing
      const parserResult = parseCustomPropertyName(input)
      expect(parserResult).toBeDefined()
      expect(regexResult).toEqual(parserResult)
    }
  })

  it('validates regex→parser pipeline permissiveness across all generation patterns', () => {
    // Test with various key lengths and escape patterns
    for (let index = 0; index < 100; index++) {
      const gen = new CustomPropertyGenerator(30_000 + index)

      const key = gen.validKey(1, 20)
      const suffix = gen.validSuffix(1, 20)
      const input = `---${key}-${suffix}`

      const parserResult = parseCustomPropertyName(input)
      const regexResult = parseWithRegex(input)

      // Critical property: regex never rejects what parser accepts
      if (parserResult === undefined) {
        continue
      }

      expect(regexResult).toBeDefined()

      // Feed regex output back to parser
      const [decodedKey, decodedSuffix] = regexResult!
      const reconstructed = `---${decodedKey}-${decodedSuffix}`
      const parserValidation = parseCustomPropertyName(reconstructed)

      expect(parserValidation).toBeDefined()
      expect(parserValidation).toEqual(parserResult)
    }
  })

  it('regex as pre-filter validates explicit edge cases (foreign languages, escapes, surrogates)', () => {
    // Validate regex pre-filter workflow for explicit test cases including:
    // - Foreign language characters (café, 日本語, Привет, emoji)
    // - Hex escape sequences (\63 olor, \000026B)
    // - Simple escape sequences (\-, \&)
    // - Surrogate pairs (𝔸, 😀)
    // - Mixed escaped/unescaped content

    for (const input of testCases) {
      // Workflow: regex pre-filter → parser validation
      const regexMatches = CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX.test(input)
      const parserResult = parseCustomPropertyName(input)

      // Parser accepts all testCases (they're valid)
      expect(parserResult).toBeDefined()

      // Regex MUST accept if parser accepts (permissive filter property)
      expect(regexMatches).toBe(true)

      // When regex accepts, full parsing should match
      const regexResult = parseWithRegex(input)
      expect(regexResult).toEqual(parserResult)
    }
  })

  it('decodeEscapes helper correctly handles hex escapes with space', () => {
    expect(decodeEscapes('\\2d ')).toBe('-')
    expect(decodeEscapes('\\63 olor')).toBe('color')
    expect(decodeEscapes('\\26 ')).toBe('&')
  })

  it('decodeEscapes helper correctly handles hex escapes with tab', () => {
    expect(decodeEscapes('\\2d\t')).toBe('-')
    expect(decodeEscapes('\\26\tB')).toBe('&B')
  })

  it('decodeEscapes helper correctly handles 6-digit hex escapes', () => {
    expect(decodeEscapes('\\000026')).toBe('&')
    expect(decodeEscapes('\\00006f')).toBe('o')
    expect(decodeEscapes('\\000041')).toBe('A')
  })

  it('decodeEscapes helper correctly handles simple escapes', () => {
    expect(decodeEscapes('\\-')).toBe('-')
    expect(decodeEscapes('\\&')).toBe('&')
    expect(decodeEscapes('\\?')).toBe('?')
  })

  it('decodeEscapes helper correctly handles mixed content', () => {
    expect(decodeEscapes('my\\2d key')).toBe('my-key')
    expect(decodeEscapes('B\\26 W')).toBe('B&W')
    expect(decodeEscapes('\\63\\6f\\6c\\6f\\72')).toBe('color')
  })

  it('decodeEscapes helper leaves out-of-range escapes undecoded', () => {
    expect(decodeEscapes('\\110000')).toBe('\\110000')
    expect(decodeEscapes('\\FFFFFF')).toBe('\\FFFFFF')
    expect(decodeEscapes('test\\999999')).toBe('test\\999999')
  })

  it('documents regex permissiveness for out-of-range hex escapes', () => {
    const outOfRangeInputs = ['---\\110000-value', '---\\FFFFFF-value', '---test-\\999999']

    for (const input of outOfRangeInputs) {
      const parserResult = parseCustomPropertyName(input)
      const regexResult = parseWithRegex(input)

      // Parser correctly rejects out-of-range escapes
      expect(parserResult).toBeUndefined()

      // Regex accepts syntactically (permissive filter)
      // This is expected - parser does semantic validation
      expect(regexResult).toBeDefined()
    }
  })
})

describe('CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_UNICODE_REGEX', () => {
  it('matches basic var() notation with closing parenthesis', () => {
    const input = 'var(---color-primary)'
    const matches = input.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
    const results = Array.from(matches)

    expect(results).toHaveLength(1)
    expect(results[0][0]).toBe('var(---color-primary)')
    expect(results[0][1]).toBe('color')
    expect(results[0][2]).toBe('primary')
  })

  it('matches basic var() notation with comma terminator', () => {
    const input = 'var(---font-size,'
    const matches = input.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
    const results = Array.from(matches)

    expect(results).toHaveLength(1)
    expect(results[0][0]).toBe('var(---font-size,')
    expect(results[0][1]).toBe('font')
    expect(results[0][2]).toBe('size')
  })

  it('matches Unicode characters in var() notation', () => {
    const testCases = [
      { expectedKey: 'café', expectedSuffix: 'latté', input: 'var(---café-latté)' },
      { expectedKey: '日本語', expectedSuffix: '値', input: 'var(---日本語-値,' },
      { expectedKey: 'Привет', expectedSuffix: 'Мир', input: 'var(---Привет-Мир)' },
    ]

    for (const { expectedKey, expectedSuffix, input } of testCases) {
      const matches = input.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
      const results = Array.from(matches)

      expect(results).toHaveLength(1)
      expect(results[0][1]).toBe(expectedKey)
      expect(results[0][2]).toBe(expectedSuffix)
    }
  })

  it('matches escape sequences in var() notation', () => {
    const testCases = [
      { expectedKey: '\\63 olor', expectedSuffix: 'primary', input: 'var(---\\63 olor-primary)' },
      { expectedKey: 'my\\2d key', expectedSuffix: 'value', input: 'var(---my\\2d key-value,' },
      { expectedKey: 'test', expectedSuffix: '\\76 alue', input: 'var(---test-\\76 alue)' },
    ]

    for (const { expectedKey, expectedSuffix, input } of testCases) {
      const matches = input.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
      const results = Array.from(matches)

      expect(results).toHaveLength(1)
      expect(results[0][1]).toBe(expectedKey)
      expect(results[0][2]).toBe(expectedSuffix)
    }
  })

  it('finds multiple matches with global flag', () => {
    const input = 'color: var(---color-primary); background: var(---bg-secondary, fallback)'
    const matches = input.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
    const results = Array.from(matches)

    expect(results).toHaveLength(2)

    expect(results[0][0]).toBe('var(---color-primary)')
    expect(results[0][1]).toBe('color')
    expect(results[0][2]).toBe('primary')

    expect(results[1][0]).toBe('var(---bg-secondary,')
    expect(results[1][1]).toBe('bg')
    expect(results[1][2]).toBe('secondary')
  })

  it('handles hyphens in SUFFIX segment', () => {
    const input = 'var(---btn-bg-hover-active)'
    const matches = input.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
    const results = Array.from(matches)

    expect(results).toHaveLength(1)
    expect(results[0][1]).toBe('btn')
    expect(results[0][2]).toBe('bg-hover-active')
  })

  it('does not match standard CSS custom properties', () => {
    const input = 'var(--color-primary)'
    const matches = input.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
    const results = Array.from(matches)

    expect(results).toHaveLength(0)
  })

  it('does not match malformed var() notation', () => {
    const invalidInputs = [
      'var(---color)',
      'var(---color-)',
      'var(----color-primary)',
      'var(--color-primary)',
    ]

    for (const input of invalidInputs) {
      const matches = input.matchAll(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
      const results = Array.from(matches)

      expect(results).toHaveLength(0)
    }
  })
})
