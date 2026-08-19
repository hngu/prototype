import { createError } from '@adonisjs/core/exceptions'

export const E_ALIAS_TAKEN = createError('The alias is taken', 'E_ALIAS_TAKEN', 409)
