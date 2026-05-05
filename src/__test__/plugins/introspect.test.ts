import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audienceVerifier, isInactiveToken, createTokenIntrospector } from '../../plugins/introspect.js';
import type { IntrospectLikeToken } from '../../plugins/authorization.js';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any;

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

const issuerConfig = {
  wellKnown: 'https://issuer.example.com/.well-known/openid-configuration',
  wellKnownProps: {
    issuer: 'issuer',
    authorization_endpoint: 'authorization_endpoint',
    token_endpoint: 'token_endpoint',
    introspection_endpoint: 'introspection_endpoint',
    userinfo_endpoint: 'userinfo_endpoint',
    end_session_endpoint: 'end_session_endpoint',
  },
  audience: false as const,
  client: { clientId: 'client-id', clientSecret: 'client-secret' },
};

const baseConfig = {
  issuers: { 'https://issuer.example.com': issuerConfig },
  cache: false as const,
};

const wellKnown = {
  introspection_endpoint: 'https://issuer.example.com/protocol/openid-connect/token/introspect',
};

describe('audienceVerifier', () => {
  it('returns true when audience_check is false', () => {
    expect(audienceVerifier({ audience_check: false, audience: 'anything' })).toBe(true);
  });

  it('returns true when string audience matches', () => {
    expect(audienceVerifier({ audience_check: 'my-app', audience: 'my-app' })).toBe(true);
  });

  it('returns false when string audience does not match', () => {
    expect(audienceVerifier({ audience_check: 'my-app', audience: 'other-app' })).toBe(false);
  });

  it('returns true when array audience includes the check value', () => {
    expect(audienceVerifier({ audience_check: 'my-app', audience: ['other', 'my-app'] })).toBe(true);
  });

  it('returns false when array audience excludes the check value', () => {
    expect(audienceVerifier({ audience_check: 'my-app', audience: ['other', 'another'] })).toBe(false);
  });
});

describe('isInactiveToken', () => {
  it('returns true for a payload with active: false', () => {
    expect(isInactiveToken({ active: false })).toBe(true);
  });

  it('returns false for a payload with active: true', () => {
    expect(isInactiveToken({ active: true, sub: 'x' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isInactiveToken(null)).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isInactiveToken('string')).toBe(false);
    expect(isInactiveToken(42)).toBe(false);
  });
});

describe('createTokenIntrospector', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns 401 error when token is an empty string', async () => {
    const introspect = createTokenIntrospector({ config: baseConfig, logger: mockLogger });
    const result = await introspect('', validTokenPayload, {});
    expect(result).toEqual({ active: false, error: { code: 401 } });
  });

  it('returns 401 error when issuer is not configured', async () => {
    const introspect = createTokenIntrospector({ config: baseConfig, logger: mockLogger });
    const unknownPayload = { ...validTokenPayload, iss: 'https://unknown.example.com' };
    const result = await introspect('some-token', unknownPayload, {});
    expect(result).toEqual({
      active: false,
      error: { code: 401, msg: 'Invalid Client Credential not found' },
    });
  });

  it('returns token payload on successful introspection', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wellKnown) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(validTokenPayload),
      });
    vi.stubGlobal('fetch', mockFetch);

    const introspect = createTokenIntrospector({ config: baseConfig, logger: mockLogger });
    const result = await introspect('valid-token', validTokenPayload, {});

    expect(result).toMatchObject({ active: true, sub: 'user123' });
  });

  it('returns 401 error when introspect endpoint responds with 401', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wellKnown) })
      .mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') });
    vi.stubGlobal('fetch', mockFetch);

    const introspect = createTokenIntrospector({ config: baseConfig, logger: mockLogger });
    const result = await introspect('bad-credentials-token', validTokenPayload, {});

    expect(result).toEqual({
      active: false,
      error: { code: 401, msg: 'Invalid Client Credential, unable to INTROSPECT Token' },
    });
  });

  it('returns 401 error when token is not active', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wellKnown) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ active: false }) });
    vi.stubGlobal('fetch', mockFetch);

    const introspect = createTokenIntrospector({ config: baseConfig, logger: mockLogger });
    const result = await introspect('expired-token', validTokenPayload, {});

    expect(result).toEqual({ active: false, error: { code: 401, msg: 'Token not active' } });
  });

  it('returns 403 error when audience check fails', async () => {
    const configWithAudience = {
      issuers: {
        'https://issuer.example.com': { ...issuerConfig, audience: 'expected-audience' },
      },
      cache: false as const,
    };
    const payloadWrongAud = { ...validTokenPayload, aud: 'wrong-audience' };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wellKnown) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(payloadWrongAud) });
    vi.stubGlobal('fetch', mockFetch);

    const introspect = createTokenIntrospector({ config: configWithAudience, logger: mockLogger });
    const result = await introspect('token', validTokenPayload, {});

    expect(result).toEqual({ active: false, error: { code: 403, msg: 'Audience check failed' } });
  });

  it('returns 500 error on network failure', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wellKnown) })
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const introspect = createTokenIntrospector({ config: baseConfig, logger: mockLogger });
    const result = await introspect('token', validTokenPayload, {});

    expect(result).toEqual({ active: false, error: { code: 500, msg: 'Network error' } });
  });

  it('caches the inactive-token error response when cache is enabled', async () => {
    const configWithCache = {
      issuers: { 'https://issuer.example.com': issuerConfig },
      cache: { size: 100, introspectTTL: 60000 },
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wellKnown) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ active: false }) });
    vi.stubGlobal('fetch', mockFetch);

    const introspect = createTokenIntrospector({ config: configWithCache, logger: mockLogger });
    const result = await introspect('inactive-token', validTokenPayload, {});

    expect(result).toEqual({ active: false, error: { code: 401, msg: 'Token not active' } });
  });

  it('caches the audience-failure error response when cache is enabled', async () => {
    const configWithCache = {
      issuers: {
        'https://issuer.example.com': { ...issuerConfig, audience: 'expected-audience' },
      },
      cache: { size: 100, introspectTTL: 60000 },
    };
    const payloadWrongAud = { ...validTokenPayload, aud: 'wrong-audience' };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wellKnown) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(payloadWrongAud) });
    vi.stubGlobal('fetch', mockFetch);

    const introspect = createTokenIntrospector({ config: configWithCache, logger: mockLogger });
    const result = await introspect('aud-fail-token', validTokenPayload, {});

    expect(result).toEqual({ active: false, error: { code: 403, msg: 'Audience check failed' } });
  });

  it('returns cached result on second call when cache is enabled', async () => {
    const configWithCache = {
      issuers: { 'https://issuer.example.com': issuerConfig },
      cache: { size: 100, introspectTTL: 60000 },
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wellKnown) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(validTokenPayload),
      });
    vi.stubGlobal('fetch', mockFetch);

    const introspect = createTokenIntrospector({ config: configWithCache, logger: mockLogger });
    await introspect('cached-token', validTokenPayload, {});
    await introspect('cached-token', validTokenPayload, {});

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
