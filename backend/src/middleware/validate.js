const AppError = require('../utils/AppError');

// validate(schema, 'body' | 'query' | 'params')
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new AppError(400, 'Validation failed', details));
  }
  // Express 5 makes req.query read-only; store parsed data separately and keep body in sync.
  if (source === 'body') req.body = result.data;
  else req.valid = { ...(req.valid || {}), [source]: result.data };
  next();
};

module.exports = validate;
