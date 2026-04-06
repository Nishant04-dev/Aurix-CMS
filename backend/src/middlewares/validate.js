import { badRequest } from '../utils/response.js';

/**
 * Zod schema validator middleware factory
 * Usage: validate(MyZodSchema)
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return badRequest(res, errors.join('; '));
    }
    req.body = result.data; // use parsed/coerced data
    next();
  };
}
