/**
 * Declarations for `single-export.cjs` — given.
 *
 * `export =` is the only way to describe `module.exports = fn`, and it is worth noticing
 * that it is legal *here* while being banned in every `.ts` file in this package:
 * `erasableSyntaxOnly` skips files that emit nothing. Verified against tsc 6.0.3.
 */
declare function slugify(text: string): string
export = slugify
