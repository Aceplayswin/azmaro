/** Application error that maps directly to an HTTP response. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown, code = "BAD_REQUEST") =>
  new AppError(400, code, message, details);
export const unauthorized = (message = "Please sign in to continue.", code = "UNAUTHORIZED") =>
  new AppError(401, code, message);
export const forbidden = (message = "You do not have permission to do that.", code = "FORBIDDEN") =>
  new AppError(403, code, message);
export const notFound = (what = "Resource", code = "NOT_FOUND") => new AppError(404, code, `${what} not found.`);
export const conflict = (message: string, details?: unknown, code = "CONFLICT") =>
  new AppError(409, code, message, details);
export const unprocessable = (message: string, details?: unknown, code = "UNPROCESSABLE") =>
  new AppError(422, code, message, details);
export const serviceUnavailable = (message: string, code = "SERVICE_UNAVAILABLE") =>
  new AppError(503, code, message);
