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
const LOWER_Z = 0x7a
const LOWER_F = 0x66
const SPACE = 0x20
const TAB = 0x09
const LF = 0x0a
const CR = 0x0d
const FF = 0x0c
const SURROGATE_MIN = 0xd8_00
const SURROGATE_MAX = 0xdf_ff

/**
 * Character code is a hex digit (0-9, A-F, a-f).
 */
function isHexDigit(code: number): boolean {
  const lower = code | 0x20
  return (code >= ZERO && code <= NINE) || (lower >= LOWER_A && lower <= LOWER_F)
}

/**
 * Converts hex digit character code to numeric value.
 */
function hexDigitValue(code: number): number {
  if (code >= ZERO && code <= NINE) return code - ZERO
  const lower = code | 0x20
  return lower - LOWER_A + 10
}

/**
 * Character code is non-ASCII
 */
function isNonASCII(code: number): boolean {
  return code >= 0x80
}

/**
 * Converts code point to string, using fast path for BMP non-surrogates.
 */
function fromCodePointFast(cp: number): string {
  return (cp <= 0xff_ff && (cp < SURROGATE_MIN || cp > SURROGATE_MAX))
    ? String.fromCharCode(cp)
    : String.fromCodePoint(cp)
}

/**
 * Character code is valid identifier character for custom property names
 * (letter, digit, underscore, or non-ASCII). Hyphens are handled separately
 * via allowUnescapedHyphen parameter.
 */
function isIdent(code: number): boolean {
  // ASCII fast path
  if ((code >= UPPER_A && code <= UPPER_Z) || (code >= LOWER_A && code <= LOWER_Z)) return true
  if ((code >= ZERO && code <= NINE) || code === UNDERSCORE) return true
  // Non-ASCII
  return isNonASCII(code)
}

/**
 * Parses an escape sequence starting at the given index. Returns the unescaped
 * character and the new position after the escape sequence.
 */
function parseEscape(input: string, index: number): [string, number] | undefined {
  const length = input.length

  if (index + 1 > length || input.charCodeAt(index) !== BACKSLASH) {
    return undefined
  }

  index++
  const code = input.charCodeAt(index)

  if (isHexDigit(code)) {
    let hexValue = hexDigitValue(code)
    index++

    let digitCount = 1
    while (index < length && digitCount < 6) {
      const digitCode = input.charCodeAt(index)
      if (!isHexDigit(digitCode)) {
        break
      }
      hexValue = (hexValue << 4) + hexDigitValue(digitCode)
      index++
      digitCount++
    }

    if (hexValue > 0x10_ff_ff) {
      return undefined
    }

    const char = fromCodePointFast(hexValue)

    if (index < length) {
      const t = input.charCodeAt(index)
      if (t === SPACE || t === TAB) index++
    }

    return [char, index]
  }

  if (code !== LF && code !== CR && code !== FF) {
    return [input.charAt(index), index + 1]
  }

  return undefined
}

/**
 * Parses a CSS identifier segment, supporting escape sequences. Returns the
 * identifier string and the new position, or undefined if parsing fails.
 */
function parseIdentSegment(
  input: string,
  start: number,
  allowUnescapedHyphen: boolean,
): [string, number] | undefined {
  const length = input.length
  let index = start

  /**
   * Scans remaining identifier characters after the first character or escape sequence.
   * Accumulates valid identifier characters, escape sequences, and optional hyphens
   * (when allowUnescapedHyphen is true) into result string.
   */
  function scanTail(result: string, index: number): [string, number] | undefined {
    while (index < length) {
      const code = input.charCodeAt(index)

      if (code === BACKSLASH) {
        const escapeResult = parseEscape(input, index)
        if (escapeResult === undefined) return undefined
        const [char, newPos] = escapeResult
        result += char
        index = newPos
        continue
      }

      if (code === DASH) {
        if (!allowUnescapedHyphen) break
        result += input[index]
        index++
        continue
      }

      if (code >= SURROGATE_MIN && code <= SURROGATE_MAX) {
        const codePoint = input.codePointAt(index)!
        if (isIdent(codePoint)) {
          result += fromCodePointFast(codePoint)
          index += 2
          continue
        }
        break
      }

      if (isIdent(code)) {
        const runStart = index
        index++
        while (index < length) {
          const nextCode = input.charCodeAt(index)
          if (nextCode === BACKSLASH || nextCode === DASH || nextCode >= SURROGATE_MIN) break
          if (!isIdent(nextCode)) break
          index++
        }
        result += input.slice(runStart, index)
        continue
      }

      break
    }
    return [result, index]
  }

  if (index >= length) {
    return undefined
  }

  const firstCode = input.charCodeAt(index)
  let firstCodePoint: number
  let firstCharSize: number

  if (firstCode >= SURROGATE_MIN && firstCode <= SURROGATE_MAX) {
    firstCodePoint = input.codePointAt(index)!
    firstCharSize = 2
  } else {
    firstCodePoint = firstCode
    firstCharSize = 1
  }

  if (firstCodePoint === BACKSLASH) {
    const escapeResult = parseEscape(input, index)
    if (escapeResult === undefined) {
      return undefined
    }
    const [char, newPos] = escapeResult
    index = newPos
    const cont = scanTail(char, index)
    if (cont === undefined) return undefined
    return cont
  }

  if (!isIdent(firstCodePoint)) {
    return undefined
  }

  const segmentStart = index
  index += firstCharSize

  while (index < length) {
    const code = input.charCodeAt(index)

    if (code === BACKSLASH) {
      let result = input.slice(segmentStart, index)
      const escapeResult = parseEscape(input, index)
      if (escapeResult === undefined) {
        return undefined
      }
      const [char, newPos] = escapeResult
      result += char
      index = newPos
      const cont = scanTail(result, index)
      if (cont === undefined) return undefined
      return cont
    }

    if (code === DASH) {
      if (!allowUnescapedHyphen) {
        break
      }
      index++
      continue
    }

    if (code >= SURROGATE_MIN && code <= SURROGATE_MAX) {
      const codePoint = input.codePointAt(index)!
      if (isIdent(codePoint)) {
        let result = input.slice(segmentStart, index)
        result += fromCodePointFast(codePoint)
        index += 2
        const cont = scanTail(result, index)
        if (cont === undefined) return undefined
        return cont
      }
      break
    }

    if (!isIdent(code)) {
      break
    }

    index++
  }

  return [input.slice(segmentStart, index), index]
}

/**
 * Parses Cassiopeia custom property names matching `---KEY-SUFFIX` patterns.
 * Returns tuple of [key, suffix] on successful parse, undefined otherwise.
 * Supports identifier characters (letters, digits, underscores, non-ASCII)
 * and CSS escape sequences at any position.
 *
 * Structural requirements:
 * - Anchored to entire string (start to end)
 * - Prefix: exactly three literal, unescaped hyphens `---`
 * - KEY: valid escapes or identifier code points (letters, digits, underscores,
 *   non-ASCII) excluding unescaped hyphens
 * - Separator: exactly one literal, unescaped hyphen
 * - SUFFIX: one or more valid escapes or identifier code points (hyphens allowed)
 * - Case-sensitive: preserves exact code points
 *
 * @param input - String to parse
 * @returns Tuple [key, suffix] if valid, undefined otherwise
 */
export function parseCustomPropertyName(input: string): [string, string] | undefined {
  const length = input.length

  if (length < 6) {
    return undefined
  }

  if (
    input.charCodeAt(0) !== DASH ||
    input.charCodeAt(1) !== DASH ||
    input.charCodeAt(2) !== DASH
  ) {
    return undefined
  }

  const keyResult = parseIdentSegment(input, 3, false)
  if (keyResult === undefined) {
    return undefined
  }

  const [key, keyEnd] = keyResult

  if (input.charCodeAt(keyEnd) !== DASH) {
    return undefined
  }

  const suffixResult = parseIdentSegment(input, keyEnd + 1, true)
  if (suffixResult === undefined) {
    return undefined
  }

  const [suffix, suffixEnd] = suffixResult

  if (suffixEnd !== length) {
    return undefined
  }

  return [key, suffix]
}
