export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const response = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Something went wrong',
      details: err.details || null,
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    }
  };

  res.status(statusCode).json(response);
}