import vine from '@vinejs/vine'

/**
 * Validator for creating a shortened URL.
 * `url` is syntax-checked only; `alias` is an optional URL-safe slug.
 */
export const createShortUrlValidator = vine.create({
  url: vine
    .string()
    .trim()
    .url({
      protocols: ['http', 'https'],
      require_protocol: true,
    }),
  alias: vine
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .maxLength(64)
    .nullable()
    .optional(),
})
