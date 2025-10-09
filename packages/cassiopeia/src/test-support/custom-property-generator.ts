import { pickRandom, Smush32, type IRandom } from '@thi.ng/random'

/**
 * Generator for creating valid and invalid Cassiopeia custom property name test inputs.
 */
export class CustomPropertyGenerator {
  private readonly rng: IRandom

  constructor(seed?: number) {
    this.rng = seed !== undefined ? new Smush32(seed) : new Smush32(Date.now())
  }
  /**
   * Generate a identifier character (letter, digit, underscore, or non-ASCII).
   */
  identChar(): string {
    const choice = this.rng.minmaxInt(0, 6)
    if (choice === 0) {
      return String.fromCharCode(this.rng.minmaxInt(0x41, 0x5b))
    } else if (choice === 1) {
      return String.fromCharCode(this.rng.minmaxInt(0x30, 0x3a))
    } else if (choice === 2) {
      return String.fromCharCode(this.rng.minmaxInt(0x61, 0x7b))
    } else if (choice === 3) {
      return '_'
    } else {
      const nonAsciiRanges = [
        [0xc0, 0xff],
        [0x1_00, 0x1_7f],
        [0x3_91, 0x3_a9],
        [0x3_b1, 0x3_c9],
        [0x4e_00, 0x9f_ff],
        [0x1_d4_00, 0x1_d7_ff],
        [0x1_f6_00, 0x1_f6_4f],
        [0x2_00_00, 0x2_a6_df],
      ]
      const range = pickRandom(nonAsciiRanges, this.rng)
      return String.fromCodePoint(this.rng.minmaxInt(range[0], range[1] + 1))
    }
  }

  /**
   * Generate a hex escape sequence for a character.
   * Always includes trailing space to prevent ambiguity with following hex digits.
   */
  hexEscape(char: string): string {
    const codePoint = char.codePointAt(0)!
    if (codePoint > 0x10_ff_ff || codePoint < 0) {
      return char
    }
    const hex = codePoint.toString(16)
    return `\\${hex} `
  }

  /**
   * Generate a safe ASCII identifier character (letter, digit or underscore only).
   */
  safeIdentChar(): string {
    const choice = this.rng.minmaxInt(0, 4)
    if (choice === 0) {
      return String.fromCharCode(this.rng.minmaxInt(0x41, 0x5b))
    } else if (choice === 1) {
      return String.fromCharCode(this.rng.minmaxInt(0x30, 0x3a))
    } else if (choice === 2) {
      return String.fromCharCode(this.rng.minmaxInt(0x61, 0x7b))
    } else {
      return '_'
    }
  }

  /**
   * Generate a valid KEY (no unescaped hyphens).
   */
  validKey(minLength = 1, maxLength = 10): string {
    const length = this.rng.minmaxInt(minLength, maxLength + 1)
    let result = ''

    const useEscapeForFirst = this.rng.float() < 0.1
    result += useEscapeForFirst ? this.hexEscape(this.safeIdentChar()) : this.identChar()

    for (let index = 1; index < length; index++) {
      const useEscape = this.rng.float() < 0.1
      result += useEscape ? this.hexEscape(this.safeIdentChar()) : this.identChar()
    }

    return result
  }

  /**
   * Generate a valid SUFFIX (can have unescaped hyphens).
   */
  validSuffix(minLength = 1, maxLength = 10): string {
    const length = this.rng.minmaxInt(minLength, maxLength + 1)
    let result = ''

    const useEscapeForFirst = this.rng.float() < 0.1
    result += useEscapeForFirst ? this.hexEscape(this.safeIdentChar()) : this.identChar()

    for (let index = 1; index < length; index++) {
      const choice = this.rng.float()

      if (choice < 0.1) {
        result += this.hexEscape(this.safeIdentChar())
      } else if (choice < 0.2) {
        result += this.hexEscape('-')
      } else if (choice < 0.4) {
        result += '-'
      } else {
        result += this.identChar()
      }
    }

    return result
  }

  /**
   * Generate a valid custom property name.
   */
  validCustomPropertyName(): string {
    const key = this.validKey(1, 15)
    const suffix = this.validSuffix(1, 15)
    return `---${key}-${suffix}`
  }

  /**
   * Generate an invalid prefix (not exactly three hyphens).
   */
  invalidPrefix(): string {
    const choices = ['--', '----', '-', '', '-----']
    return pickRandom(choices, this.rng)
  }

  /**
   * Generate an invalid character (not allowed in identifiers).
   */
  invalidCharacter(): string {
    const invalidChars = [
      0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2e, 0x2f,
      0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40, 0x5b, 0x5d, 0x5e, 0x60, 0x7b, 0x7c, 0x7d, 0x7e,
    ]
    return String.fromCharCode(pickRandom(invalidChars, this.rng))
  }

  /**
   * Generate an invalid custom property name using both hardcoded patterns
   * and generated components to ensure comprehensive coverage.
   */
  invalidCustomPropertyName(): string {
    const choice = this.rng.minmaxInt(0, 10)

    switch (choice) {
      case 0:
        // Wrong prefix (not exactly three hyphens)
        return `${this.invalidPrefix()}color-primary`
      case 1:
        // Missing both KEY and SUFFIX
        return '---'
      case 2:
        // Missing separator and SUFFIX
        return `---${this.safeIdentChar()}`
      case 3:
        // Missing SUFFIX (ends with separator)
        return `---${this.safeIdentChar()}${this.safeIdentChar()}-`
      case 4:
        // Space before separator in KEY
        return `---${this.safeIdentChar()} -${this.safeIdentChar()}`
      case 5:
        // Trailing space after SUFFIX
        return `---${this.safeIdentChar()}-${this.safeIdentChar()} `
      case 6:
        // Invalid character in KEY
        return `---${this.safeIdentChar()}@-${this.safeIdentChar()}`
      case 7:
        // Invalid escape sequence (backslash-hyphen without hex digits)
        return `---${this.safeIdentChar()}\\-${this.safeIdentChar()}`
      case 8:
        // Out-of-range hex escape in SUFFIX
        return `---${this.safeIdentChar()}-${this.safeIdentChar()}\\110000`
      case 9:
        // Space in middle of SUFFIX
        return `---${this.safeIdentChar()}-${this.safeIdentChar()}${this.safeIdentChar()} x`
      default:
        // Invalid character at start of KEY
        return `---${this.invalidCharacter()}x-y`
    }
  }
}
