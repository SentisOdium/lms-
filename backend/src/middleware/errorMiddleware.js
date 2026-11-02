/**
 * Centralized Error Handling Middleware
 */
export function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.url} ->`, err);

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * 404 Route Handler
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
}

