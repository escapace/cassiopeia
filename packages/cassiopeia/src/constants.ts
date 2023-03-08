/*
 * A custom property is any property whose name starts with two dashes (U+002D
 * HYPHEN-MINUS), like --foo. The <custom-property-name> production corresponds
 * to this: it’s defined as any <dashed-ident> (a valid identifier that starts
 * with two dashes), except -- itself, which is reserved for future use by CSS.
 *
 * The <dashed-ident> production is a <custom-ident>, with all the
 * case-sensitivity that implies, with the additional restriction that it must
 * start with two dashes (U+002D HYPHEN-MINUS).
 *
 * This generic data type is denoted by <custom-ident>, and represents any valid
 * CSS identifier that would not be misinterpreted as a pre-defined keyword in
 * that property’s value definition.
 *
 * https://www.w3.org/TR/css-syntax-3/#ident-token-diagram
 */
export const REGEX = /var\(---([a-zA-Z0-9]+)-([a-zA-Z-0-9]+)[),]/gm
export const STORE = Symbol.for('cassiopeia/store')
export const PLUGIN = Symbol.for('cassiopeia/plugin')
