import { describe, it, expect, vi } from 'vitest';
import { createAuthorize, IntrospectLikeTokenSchema } from '../../plugins/authorization.js';
import type { IntrospectLikeToken } from '../../plugins/authorization.js';

function makeJwt(payload: object): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `header.${b64}.signature`;
}

const validTokenPayload: IntrospectLikeToken = {
  active: true,
  iss: 'https://issuer.example.com',
  exp: 9999999999,
  aud: 'my-client',
  sub: 'user123',
  iat: 1000000000,
  azp: 'my-client',
  jti: 'token-id-123',
  cached: false,
};

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any;

const mockHttpErrors = {
  unauthorized: vi.fn((msg: string) => new Error(msg)),
  forbidden: vi.fn((msg: string) => new Error(msg)),
} as any;

function makeMockReply() {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  return { status, send };
}

describe('IntrospectLikeTokenSchema', () => {
  it('parses a valid token payload', () => {
    const result = IntrospectLikeTokenSchema.safeParse(validTokenPayload);
    expect(result.success).toBe(true);
  });

  it('defaults cached to false', () => {
    const { cached: _cached, ...withoutCached } = validTokenPayload;
    const result = IntrospectLikeTokenSchema.safeParse(withoutCached);
    expect(result.success && result.data.cached).toBe(false);
  });

  it('accepts array audience', () => {
    const result = IntrospectLikeTokenSchema.safeParse({ ...validTokenPayload, aud: ['a', 'b'] });
    expect(result.success).toBe(true);
  });

  it('defaults aud to empty array when not provided', () => {
    const { aud: _aud, ...withoutAud } = validTokenPayload;
    const result = IntrospectLikeTokenSchema.safeParse(withoutAud);
    // aud has a default ([]) via the array branch of the union
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.aud)).toBe(true);
    }
  });

  it('fails when required fields are missing', () => {
    const result = IntrospectLikeTokenSchema.safeParse({ active: true });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = IntrospectLikeTokenSchema.safeParse({
      ...validTokenPayload,
      email: 'user@example.com',
      scope: 'openid profile',
      username: 'user123',
    });
    expect(result.success).toBe(true);
  });
});

describe('createAuthorize', () => {
  it('returns 401 when authorization header is missing', async () => {
    const { status, send } = makeMockReply();
    const authorize = createAuthorize({
      logger: mockLogger,
      introspect: vi.fn(),
      httpErrors: mockHttpErrors,
    });

    await authorize({ headers: {} } as any, { status, send } as any);

    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when authorization type is not Bearer', async () => {
    const { status, send } = makeMockReply();
    const token = makeJwt(validTokenPayload);
    const authorize = createAuthorize({
      logger: mockLogger,
      introspect: vi.fn(),
      httpErrors: mockHttpErrors,
    });

    await authorize(
      { headers: { authorization: `Basic ${token}` } } as any,
      { status, send } as any
    );

    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when authorization has extra segments', async () => {
    const { status, send } = makeMockReply();
    const token = makeJwt(validTokenPayload);
    const introspect = vi.fn().mockResolvedValue(validTokenPayload);
    const authorize = createAuthorize({ logger: mockLogger, introspect, httpErrors: mockHttpErrors });

    await authorize(
      { headers: { authorization: `Bearer ${token} extra` } } as any,
      { status, send } as any
    );

    expect(status).toHaveBeenCalledWith(401);
  });

  it('sets req.user on successful authorization', async () => {
    const { status, send } = makeMockReply();
    const token = makeJwt(validTokenPayload);
    const introspect = vi.fn().mockResolvedValue(validTokenPayload);
    const authorize = createAuthorize({ logger: mockLogger, introspect, httpErrors: mockHttpErrors });

    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    await authorize(req, { status, send } as any);

    expect(req.user).toBeDefined();
    expect(req.user.sub).toBe('user123');
    expect(status).not.toHaveBeenCalled();
  });

  it('returns 401 when introspection returns inactive token', async () => {
    const { status, send } = makeMockReply();
    const token = makeJwt(validTokenPayload);
    const introspect = vi.fn().mockResolvedValue({ active: false, error: { code: 401 } });
    const authorize = createAuthorize({ logger: mockLogger, introspect, httpErrors: mockHttpErrors });

    await authorize(
      { headers: { authorization: `Bearer ${token}` } } as any,
      { status, send } as any
    );

    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when introspection returns a 403 error code', async () => {
    const { status, send } = makeMockReply();
    const token = makeJwt(validTokenPayload);
    const introspect = vi.fn().mockResolvedValue({ active: false, error: { code: 403 } });
    const authorize = createAuthorize({ logger: mockLogger, introspect, httpErrors: mockHttpErrors });

    await authorize(
      { headers: { authorization: `Bearer ${token}` } } as any,
      { status, send } as any
    );

    expect(status).toHaveBeenCalledWith(403);
  });

  it('returns 401 when introspect returns a payload that fails schema validation', async () => {
    const { status, send } = makeMockReply();
    const token = makeJwt(validTokenPayload);
    const introspect = vi.fn().mockResolvedValue({ active: true, sub: 'only-sub' });
    const authorize = createAuthorize({ logger: mockLogger, introspect, httpErrors: mockHttpErrors });

    await authorize(
      { headers: { authorization: `Bearer ${token}` } } as any,
      { status, send } as any
    );

    expect(status).toHaveBeenCalledWith(401);
  });
});
