/**
 * A custom property is any property whose name starts with two dashes (U+002D
 * HYPHEN-MINUS), like --foo. The <custom-property-name> production corresponds
 * to this: it's defined as any <dashed-ident> (a valid identifier that starts
 * with two dashes), except -- itself, which is reserved for future use by CSS.
 *
 * The <dashed-ident> production is a <custom-ident>, with all the
 * case-sensitivity that implies, with the additional restriction that it must
 * start with two dashes (U+002D HYPHEN-MINUS).
 *
 * This generic data type is denoted by <custom-ident>, and represents any valid
 * CSS identifier that would not be misinterpreted as a pre-defined keyword in
 * that property's value definition.
 *
 * https://www.w3.org/TR/css-syntax-3/#ident-token-diagram
 *
 * Cassiopeia regex matches var(---key-suffix) patterns where:
 * - First capture group `([\dA-Za-z]+)`: key identifying the target reducer
 * - Second capture group `([\dA-Za-z-]+)`: suffix identifier within the key's domain
 */
export const CASSIOPEIA_REGEX = /var\(---([\dA-Za-z]+)-([\dA-Za-z-]+)[),]/g

export const CASSIOPEIA_CONTEXT = Symbol.for('cassiopeia/context')
export const CASSIOPEIA_STATE = Symbol.for('cassiopeia/state')
export const CASSIOPEIA_PLUGIN = Symbol.for('cassiopeia/plugin')
