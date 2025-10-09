/**
 * Parses Cassiopeia custom property names in the format `---KEY-SUFFIX`.
 *
 * The parser validates property names against this grammar:
 *
 * - Three literal dashes (`---`) prefix the property name
 * - KEY: identifier without unescaped hyphens
 * - SUFFIX: identifier that may contain unescaped hyphens
 *
 * Identifiers may include letters (A-Z, a-z), digits (0-9), underscores (_), and non-ASCII
 * characters in any position.
 *
 * The KEY segment cannot contain unescaped hyphens. Use escape sequences for hyphens in KEY: `\2d`
 * (with trailing space or tab) or `\-`.
 *
 * The SUFFIX segment may contain unescaped hyphens.
 *
 * The parser handles CSS escape sequences:
 *
 * - Hex escapes: `\26` (1-6 hex digits followed by space or tab) or `\000026` (exactly 6 hex digits,
 *   no trailing space required)
 * - Simple escapes: `\&` (backslash followed by any non-newline character)
 *
 * Hex escapes that decode to values above U+10FFFF are rejected. Surrogate pairs in the BMP range
 * (U+D800-U+DFFF) require proper pairing.
 *
 * The parser is case-sensitive and anchored to the entire input string. Partial matches are rejected.
 *
 * The implementation accepts both raw CSS source text and JavaScript-constructed strings. Newlines
 * after hex escapes are not supported; use space or tab as the terminator. Simple escapes cannot span
 * newlines.
 */

const BACKSLASH = 0x5c
const DASH = 0x2d
const UNDERSCORE = 0x5f
const ZERO = 0x30
const NINE = 0x39
const UPPER_A = 0x41
const UPPER_Z = 0x5a
const LOWER_A = 0x61
const LOWER_F = 0x66
const LOWER_Z = 0x7a
const SPACE = 0x20
const TAB = 0x09
const LF = 0x0a
const CR = 0x0d
const FF = 0x0c

/**
 * Character code is a hex digit (0-9, A-F, a-f).
 */
function isHexadecimalDigit(code: number): boolean {
  const lower = code | 0x20
  return (lower >= LOWER_A && lower <= LOWER_F) || (code >= ZERO && code <= NINE)
}

/**
 * Converts hex digit character code to numeric value.
 */
function hexadecimalDigitValue(code: number): number {
  if (code >= ZERO && code <= NINE) return code - ZERO
  const lower = code | 0x20
  return lower - LOWER_A + 10
}

/**
 * Parses an escape sequence starting at the given index. Returns the unescaped
 * character and the new position after the escape sequence.
 */
function readEscape(input: string, index: number): [string, number] | undefined {
  if (input.charCodeAt(index) !== BACKSLASH) return undefined
  const length = input.length
  index++
  if (index >= length) return undefined

  const code = input.charCodeAt(index)

  // Hexadecimal escape: up to 6 hex digits, optional single space or tab terminator
  if (isHexadecimalDigit(code)) {
    let value = hexadecimalDigitValue(code)
    index++

    let count = 1
    while (index < length && count < 6) {
      const digit = input.charCodeAt(index)
      if (!isHexadecimalDigit(digit)) break
      value = (value << 4) + hexadecimalDigitValue(digit)
      index++
      count++
    }

    if (value > 0x10_ff_ff) return undefined

    if (index < length) {
      const terminator = input.charCodeAt(index)
      if (terminator === SPACE || terminator === TAB) index++
    }

    return [String.fromCodePoint(value), index]
  }

  // Simple escape: any non-newline unit after a backslash
  if (code !== LF && code !== CR && code !== FF) {
    return [String.fromCharCode(code), index + 1]
  }

  return undefined
}

/**
 * Parses a CSS identifier segment, supporting escape sequences. Returns the
 * identifier string and the new position, or undefined if parsing fails.
 */
function parseIdentifierSegment(
  input: string,
  start: number,
  allowUnescapedHyphen: boolean,
): [string, number] | undefined {
  const length = input.length
  let index = start
  let result = ''

  while (index < length) {
    const unit = input.charCodeAt(index)

    if (unit === BACKSLASH) {
      const escapeResult = readEscape(input, index)
      if (escapeResult === undefined) return undefined
      const [character, nextIndex] = escapeResult
      result += character
      index = nextIndex
      continue
    }

    if (unit === DASH) {
      if (!allowUnescapedHyphen) break
      // result += input[index++]
      result += '-'
      index++
      continue
    }

    // Accept ASCII identifier characters
    if (
      (unit >= LOWER_A && unit <= LOWER_Z) ||
      (unit >= UPPER_A && unit <= UPPER_Z) ||
      (unit >= ZERO && unit <= NINE) ||
      unit === UNDERSCORE
    ) {
      result += String.fromCharCode(unit)
      index++
      continue
    }

    // Accept any non-ASCII code point
    if (unit >= 0x80) {
      const codePoint = input.codePointAt(index)!
      result += String.fromCodePoint(codePoint)
      index += codePoint > 0xff_ff ? 2 : 1
      continue
    }

    break
  }

  if (index === start) return undefined
  return [result, index]
}

/**
 * Parses Cassiopeia custom property names with `---KEY-SUFFIX` structure.
 *
 * Pattern requirements:
 * - Prefix: three literal hyphens `---`
 * - KEY: identifier characters (letters, digits, underscore, non-ASCII) or CSS escapes; unescaped hyphens rejected
 * - Separator: one literal hyphen `-`
 * - SUFFIX: identifier characters or CSS escapes; unescaped hyphens allowed
 * - Anchored to entire input; partial matches rejected
 * - Case-sensitive
 *
 * @param input - String to parse
 * @returns Tuple `[key, suffix]` when input matches pattern, `undefined` otherwise
 */
export function parseCustomPropertyName(input: string): [string, string] | undefined {
  const length = input.length
  if (length < 6) return undefined
  if (!input.startsWith('---')) return undefined

  const keyParsed = parseIdentifierSegment(input, 3, false)
  if (keyParsed === undefined) return undefined
  const [key, afterKey] = keyParsed

  if (afterKey >= length || input.charCodeAt(afterKey) !== DASH) return undefined

  const suffixParsed = parseIdentifierSegment(input, afterKey + 1, true)
  if (suffixParsed === undefined) return undefined
  const [suffix, afterSuffix] = suffixParsed

  if (afterSuffix !== length) return undefined

  return [key, suffix]
}
