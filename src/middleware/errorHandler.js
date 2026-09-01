// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || "internal server error";
  if (status >= 500) console.error("[error]", err);
  res.status(status).json({ message, error: status >= 500 ? message : undefined });
}

function notFound(req, res) {
  res.status(404).json({ message: `route not found: ${req.method} ${req.path}` });
}

module.exports = { errorHandler, notFound };
