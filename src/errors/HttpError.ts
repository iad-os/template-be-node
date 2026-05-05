import httpStatus from 'http-status';

export abstract class HttpError extends Error {
  abstract statusCode: number;
  details?: unknown;

  constructor(args: { message?: string; details?: unknown }) {
    const { message, details } = args;
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export class BadRequestError extends HttpError {
  statusCode = httpStatus.BAD_REQUEST;
  constructor(args?: { message?: string; details?: unknown }) {
    const { message = httpStatus[httpStatus.BAD_REQUEST], details } = args ?? {};
    super({ message, details });
  }
}

export class UnauthorizedError extends HttpError {
  statusCode = httpStatus.UNAUTHORIZED;
  constructor(args?: { message?: string; details?: unknown }) {
    const { message = httpStatus[httpStatus.UNAUTHORIZED], details } = args ?? {};
    super({ message, details });
  }
}

export class ForbiddenError extends HttpError {
  statusCode = httpStatus.FORBIDDEN;
  constructor(args?: { message?: string; details?: unknown }) {
    const { message = httpStatus[httpStatus.FORBIDDEN], details } = args ?? {};
    super({ message, details });
  }
}

export class NotFoundError extends HttpError {
  statusCode = httpStatus.NOT_FOUND;
  constructor(args?: { message?: string; details?: unknown }) {
    const { message = httpStatus[httpStatus.NOT_FOUND], details } = args ?? {};
    super({ message, details });
  }
}

export class ConflictError extends HttpError {
  statusCode = httpStatus.CONFLICT;
  constructor(args?: { message?: string; details?: unknown }) {
    const { message = httpStatus[httpStatus.CONFLICT], details } = args ?? {};
    super({ message, details });
  }
}

export class UnprocessableEntityError extends HttpError {
  statusCode = httpStatus.UNPROCESSABLE_ENTITY;
  constructor(args?: { message?: string; details?: unknown }) {
    const { message = httpStatus[httpStatus.UNPROCESSABLE_ENTITY], details } = args ?? {};
    super({ message, details });
  }
}

export class TooManyRequestsError extends HttpError {
  statusCode = httpStatus.TOO_MANY_REQUESTS;
  constructor(args?: { message?: string; details?: unknown }) {
    const { message = httpStatus[httpStatus.TOO_MANY_REQUESTS], details } = args ?? {};
    super({ message, details });
  }
}

export class PreconditionFailedError extends HttpError {
  statusCode = httpStatus.PRECONDITION_FAILED;
  constructor(args?: { message?: string; details?: unknown }) {
    const { message = httpStatus[httpStatus.PRECONDITION_FAILED], details } = args ?? {};
    super({ message, details });
  }
}

export class InternalServerError extends HttpError {
  statusCode = httpStatus.INTERNAL_SERVER_ERROR;
  constructor(args?: { message?: string; details?: unknown }) {
    const { message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR], details } = args ?? {};
    super({ message, details });
  }
}
