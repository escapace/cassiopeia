/* eslint-disable math/prefer-math-trunc */
/**
 * Pattern matching identifier characters excluding hyphens.
 * Matches: letters (A-Z, a-z), digits (0-9), underscore (_), and all non-ASCII
 * characters (U+0080–U+10FFFF).
 */
const IDENTIFIER_CHAR_PATTERN = String.raw`[\w\u{80}-\u{10FFFF}]`

/**
 * Pattern matching identifier characters including hyphens.
 * Matches: letters (A-Z, a-z), digits (0-9), underscore (_), hyphen (-), and all
 * non-ASCII characters (U+0080–U+10FFFF).
 */
const IDENTIFIER_CHAR_WITH_DASH_PATTERN = String.raw`[\w\-\u{80}-\u{10FFFF}]`

/**
 * Pattern matching CSS escape sequences (literal form, not decoded).
 * Matches:
 * - Hex escapes: `\2d ` (1-6 hex digits followed by optional space/tab)
 * - Simple escapes: `\-` (backslash followed by any non-hex-digit, non-newline character)
 */
const ESCAPE_SEQUENCE_PATTERN = String.raw`\\[0-9a-f]{1,6}[ \t]?|\\[^0-9a-f\r\n\f]`

/**
 * Unicode-aware regex matching Cassiopeia custom property names with escape sequence support.
 * Performs syntactic validation for `---key-suffix` patterns.
 *
 * Design philosophy: Permissive by design—accepts inputs that may be semantically invalid
 * (e.g., out-of-range hex escapes). Final validation is delegated to the hand-rolled parser.
 * The regex serves as a fast pre-filter before parser validation.
 *
 * Identifier characters: letters (A-Z, a-z), digits (0-9), underscore (_), and all non-ASCII
 * characters (U+0080–U+10FFFF). Digits are allowed at the start of identifiers.
 *
 * Escape sequences (matched literally, not decoded):
 * - Hex escapes: `\2d ` (1-6 hex digits + optional space/tab)
 * - Simple escapes: `\-` (backslash + any non-newline character)
 *
 * Structural constraints:
 * - Prefix: exactly three literal hyphens `---`
 * - KEY segment: cannot contain unescaped hyphens (use `\2d ` or `\-` for hyphens in KEY)
 * - Separator: exactly one literal hyphen `-`
 * - SUFFIX segment: can contain unescaped hyphens after the first character
 *
 * Requires the `u` flag for full Unicode support including supplementary planes.
 * Uses the `i` flag for case-insensitive hex digit matching.
 *
 * Capture groups:
 * - `(1)`: KEY with literal escape sequences
 * - `(2)`: SUFFIX with literal escape sequences
 *
 * @example
 * ```typescript
 * CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX.test('---color-primary') // true
 * CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX.test('---café-latté') // true
 * CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX.test('---my\\2d key-value') // true
 * CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX.test('--color-primary') // false (wrong prefix)
 * ```
 */
export const CASSIOPEIA_CUSTOM_PROPERTY_NAME_REGEX = new RegExp(
  String.raw`^---((?:${IDENTIFIER_CHAR_PATTERN}|${ESCAPE_SEQUENCE_PATTERN})+)-((?:${IDENTIFIER_CHAR_PATTERN}|${ESCAPE_SEQUENCE_PATTERN})(?:${IDENTIFIER_CHAR_WITH_DASH_PATTERN}|${ESCAPE_SEQUENCE_PATTERN})*)$`,
  'iu',
)

/**
 * Unicode-aware regex matching `var(---key-suffix)` patterns in CSS stylesheets with escape
 * sequence support. Extracts the reducer key and suffix from Cassiopeia custom property
 * references embedded in var() functions.
 *
 * Design philosophy: Permissive by design—accepts inputs that may be semantically invalid
 * (e.g., out-of-range hex escapes). Final validation is delegated to the hand-rolled parser.
 * The regex serves as a fast pre-filter before parser validation.
 *
 * Identifier characters: letters (A-Z, a-z), digits (0-9), underscore (_), and all non-ASCII
 * characters (U+0080–U+10FFFF). Digits are allowed at the start of identifiers.
 *
 * Escape sequences (matched literally, not decoded):
 * - Hex escapes: `\2d ` (1-6 hex digits + optional space/tab)
 * - Simple escapes: `\-` (backslash + any non-newline character)
 *
 * Structural constraints:
 * - Prefix: `var(---` (var function with three literal hyphens)
 * - KEY segment: cannot contain unescaped hyphens (use `\2d ` or `\-` for hyphens in KEY)
 * - Separator: exactly one literal hyphen `-`
 * - SUFFIX segment: can contain unescaped hyphens after the first character
 * - Terminator: closing `)` or comma `,` (matches both `var(---key-suffix)` and `var(---key-suffix,)`
 *
 * Global flag finds all occurrences in a stylesheet. Requires the `u` flag for full Unicode
 * support including supplementary planes. Uses the `i` flag for case-insensitive hex digit matching.
 *
 * Capture groups:
 * - `(1)`: KEY with literal escape sequences
 * - `(2)`: SUFFIX with literal escape sequences
 *
 * @example
 * ```typescript
 * 'var(---color-primary)'.match(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
 * // Matches: ['var(---color-primary)', 'color', 'primary']
 *
 * 'var(---café-latté,'.match(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
 * // Matches: ['var(---café-latté,', 'café', 'latté']
 *
 * 'var(---my\2d key-value)'.match(CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX)
 * // Matches: ['var(---my\2d key-value)', 'my\2d key', 'value']
 * ```
 */
export const CASSIOPEIA_CUSTOM_PROPERTY_VAR_NOTATION_REGEX = new RegExp(
  String.raw`var\(---((?:${IDENTIFIER_CHAR_PATTERN}|${ESCAPE_SEQUENCE_PATTERN})+)-((?:${IDENTIFIER_CHAR_PATTERN}|${ESCAPE_SEQUENCE_PATTERN})(?:${IDENTIFIER_CHAR_WITH_DASH_PATTERN}|${ESCAPE_SEQUENCE_PATTERN})*)[),]`,
  'giu',
)

export const CASSIOPEIA_CONTEXT = Symbol.for('cassiopeia/context')
export const CASSIOPEIA_STATE = Symbol.for('cassiopeia/state')
export const CASSIOPEIA_PLUGIN = Symbol.for('cassiopeia/plugin')

/**
 * Control token signaling a generator to complete and return its final value.
 */
export const CASSIOPEIA_COMPLETE: unique symbol = Symbol.for('cassiopeia/complete')
/**
 * Control token signaling a generator to cancel
 */
export const CASSIOPEIA_CANCEL: unique symbol = Symbol.for('cassiopeia/cancel')

export enum CassiopeiaStateMachineState {
  /** No active processing, awaiting next update */
  Idle,
  /** Update received, preparing for orchestrator execution */
  PreFlight,
  /** Orchestrator actively processing stylesheets */
  InFlight,
}

export enum CassiopeiaStateMachineAction {
  /** Complete current operation and return to idle state */
  Done,
  /** Execute orchestrator to coordinate reducers and generate stylesheets */
  Reduce,
  /** Initiate new generator or reducer update cycle */
  Update,
  /** Reset the state machine */
  Reset,
}

export enum CassiopeiaStateMachineActionUpdateType {
  None = 0,

  /** Update involves generator changes (new custom property sources) */
  Generator = 1 << 0,
  /** Update involves reducer changes (plugin modifications) */
  Reducer = 1 << 1,
  /** Update involves both generator and reducer changes */
  Both = Generator | Reducer,
}
