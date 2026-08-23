// Centralized error handler so LLM/email/calendar failures never crash the request cycle.
module.exports = function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};
