import { describe, it, expect } from 'vitest';
import { FetchError, isFetchError } from '../../errors/FetchError.js';

describe('FetchError', () => {
  it('constructs with correct properties', () => {
    const err = new FetchError({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
    expect(err.statusCode).toBe(404);
    expect(err.error).toBe('Not Found');
    expect(err.message).toBe('Resource not found');
    expect(err.name).toBe('FetchError');
  });

  it('is an instance of Error', () => {
    const err = new FetchError({ statusCode: 500, error: 'Internal Server Error', message: '' });
    expect(err).toBeInstanceOf(Error);
  });

  describe('fromResponse', () => {
    it('creates FetchError from a Response', async () => {
      const response = new Response(null, { status: 503, statusText: 'Service Unavailable' });
      const err = await FetchError.fromResponse(response);
      expect(err).toBeInstanceOf(FetchError);
      expect(err.statusCode).toBe(503);
      expect(err.error).toBe('Service Unavailable');
      expect(err.message).toBe('');
    });

    it('captures status code correctly', async () => {
      const response = new Response(null, { status: 422, statusText: 'Unprocessable Entity' });
      const err = await FetchError.fromResponse(response);
      expect(err.statusCode).toBe(422);
    });
  });
});

describe('isFetchError', () => {
  it('returns true for FetchError instances', () => {
    const err = new FetchError({ statusCode: 400, error: 'Bad Request', message: '' });
    expect(isFetchError(err)).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isFetchError(new Error('plain'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFetchError(null)).toBe(false);
  });

  it('returns false for objects that look like FetchError', () => {
    expect(isFetchError({ statusCode: 400, error: 'x', message: 'y' })).toBe(false);
  });
});
