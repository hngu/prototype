/**
 * A real CommonJS module — given, not part of the exercise.
 *
 * This is the shape a great many npm packages published before 2020 still have: one object
 * assigned to `module.exports`, no `default` anywhere. It is deliberately plain JavaScript
 * with no types of its own, which is why `legacy-config.d.cts` next door exists.
 */

const DEFAULTS = { host: 'localhost', port: 5432, ssl: false }

function load(overrides) {
  return { ...DEFAULTS, ...(overrides || {}) }
}

function describe(config) {
  return `${config.host}:${config.port}${config.ssl ? ' (ssl)' : ''}`
}

module.exports = { DEFAULTS, load, describe, version: '1.4.2' }
