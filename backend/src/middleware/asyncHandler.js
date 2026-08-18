// Express doesn't catch rejected promises from async route handlers on
// its own — an unhandled rejection there crashes the whole Node process
// (that's exactly what took the server down: a DynamoDB error escaped
// uncaught). Wrapping every async handler in this forwards the error to
// Express's error-handling middleware instead, which just returns a 500.
export function ah(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}