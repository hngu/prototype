/**
 * The other legacy shape — given. `module.exports` is assigned a *function* rather than an
 * object, which is what `export =` describes and what makes the default import callable.
 */
module.exports = function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
