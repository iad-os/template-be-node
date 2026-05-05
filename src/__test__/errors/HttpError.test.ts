import { describe, it, expect } from 'vitest';
import {
  isHttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
  PreconditionFailedError,
  InternalServerError,
} from '../../errors/HttpError.js';

describe('isHttpError', () => {
  it('returns true for HttpError instances', () => {
    expect(isHttpError(new BadRequestError())).toBe(true);
    expect(isHttpError(new UnauthorizedError())).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isHttpError(new Error('plain'))).toBe(false);
  });

  it('returns false for null and primitives', () => {
    expect(isHttpError(null)).toBe(false);
    expect(isHttpError('string')).toBe(false);
    expect(isHttpError(42)).toBe(false);
  });
});

describe('BadRequestError', () => {
  it('has statusCode 400', () => {
    expect(new BadRequestError().statusCode).toBe(400);
  });

  it('has a default message', () => {
    expect(new BadRequestError().message).toBeTruthy();
  });

  it('accepts custom message and details', () => {
    const err = new BadRequestError({ message: 'custom', details: { field: 'email' } });
    expect(err.message).toBe('custom');
    expect(err.details).toEqual({ field: 'email' });
  });

  it('sets name to constructor name', () => {
    expect(new BadRequestError().name).toBe('BadRequestError');
  });
});

describe('UnauthorizedError', () => {
  it('has statusCode 401', () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });

  it('accepts custom message', () => {
    expect(new UnauthorizedError({ message: 'token expired' }).message).toBe('token expired');
  });
});

describe('ForbiddenError', () => {
  it('has statusCode 403', () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });
});

describe('NotFoundError', () => {
  it('has statusCode 404', () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });
});

describe('ConflictError', () => {
  it('has statusCode 409', () => {
    expect(new ConflictError().statusCode).toBe(409);
  });
});

describe('UnprocessableEntityError', () => {
  it('has statusCode 422', () => {
    expect(new UnprocessableEntityError().statusCode).toBe(422);
  });
});

describe('TooManyRequestsError', () => {
  it('has statusCode 429', () => {
    expect(new TooManyRequestsError().statusCode).toBe(429);
  });
});

describe('PreconditionFailedError', () => {
  it('has statusCode 412', () => {
    expect(new PreconditionFailedError().statusCode).toBe(412);
  });
});

describe('InternalServerError', () => {
  it('has statusCode 500', () => {
    expect(new InternalServerError().statusCode).toBe(500);
  });

  it('accepts details', () => {
    const err = new InternalServerError({ details: { stack: 'trace' } });
    expect(err.details).toEqual({ stack: 'trace' });
  });
});
