import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../../errors/handler/errorHandler.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../../../errors/HttpError.js';
import { FetchError } from '../../../errors/FetchError.js';

function makeMockReply() {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  return { status, send };
}

const mockRequest = {} as any;

describe('errorHandler', () => {
  it('handles HttpError with correct status and body', () => {
    const { status, send } = makeMockReply();
    const error = new BadRequestError({ message: 'bad input', details: { field: 'email' } });

    errorHandler(error, mockRequest, { status, send } as any);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({
      name: 'BadRequestError',
      message: 'bad input',
      details: { field: 'email' },
    });
  });

  it('handles UnauthorizedError', () => {
    const { status, send } = makeMockReply();
    errorHandler(new UnauthorizedError({ message: 'token missing' }), mockRequest, { status, send } as any);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'UnauthorizedError', message: 'token missing' })
    );
  });

  it('handles NotFoundError with undefined details', () => {
    const { status, send } = makeMockReply();
    errorHandler(new NotFoundError(), mockRequest, { status, send } as any);

    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'NotFoundError', details: undefined })
    );
  });

  it('handles FetchError with correct status and body', () => {
    const { status, send } = makeMockReply();
    const error = new FetchError({ statusCode: 502, error: 'Bad Gateway', message: 'upstream failure' });

    errorHandler(error, mockRequest, { status, send } as any);

    expect(status).toHaveBeenCalledWith(502);
    expect(send).toHaveBeenCalledWith({ name: 'FetchError', message: 'upstream failure' });
  });

  it('handles generic Error with 500', () => {
    const { status, send } = makeMockReply();
    errorHandler(new Error('something broke'), mockRequest, { status, send } as any);

    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({ message: 'something broke' });
  });
});
