import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWellknown, getWellknownKeyValue, credentialsVerifier, verifyToken } from '../../utils/idp.js';

vi.mock('wait-on', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

describe('getWellknownKeyValue', () => {
  it('returns the value for a given key', () => {
    const wellKnown = { introspection_endpoint: 'https://example.com/introspect', issuer: 'https://example.com' };
    expect(getWellknownKeyValue(wellKnown, 'introspection_endpoint')).toBe('https://example.com/introspect');
  });

  it('returns undefined for a missing key', () => {
    expect(getWellknownKeyValue({}, 'missing_key')).toBeUndefined();
  });
});

describe('getWellknown', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('fetches and returns the well-known JSON', async () => {
    const data = { issuer: 'https://example.com', introspection_endpoint: 'https://example.com/introspect' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) }));

    const result = await getWellknown('https://example.com/.well-known/openid-configuration');
    expect(result).toEqual(data);
  });
});

describe('credentialsVerifier', () => {
  const issuerConfig = {
    wellKnown: 'https://example.com/.well-known',
    wellKnownProps: {
      token_endpoint: 'token_endpoint',
      issuer: 'issuer',
      authorization_endpoint: 'authorization_endpoint',
      introspection_endpoint: 'introspection_endpoint',
      userinfo_endpoint: 'userinfo_endpoint',
      end_session_endpoint: 'end_session_endpoint',
    },
    audience: false as const,
    client: { clientId: 'my-client', clientSecret: 'my-secret' },
  };

  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('resolves when credentials are valid', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token_endpoint: 'https://example.com/token' }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    await expect(credentialsVerifier(issuerConfig)).resolves.toBeUndefined();
  });

  it('throws when credentials are invalid', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token_endpoint: 'https://example.com/token' }) })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', mockFetch);

    await expect(credentialsVerifier(issuerConfig)).rejects.toThrow('unable to authenticate');
  });
});

describe('verifyToken (idp)', () => {
  const validPayload = {
    active: true,
    iss: 'https://issuer.example.com',
    exp: 9999999999,
    aud: 'my-client',
    sub: 'user123',
    iat: 1000000000,
    azp: 'my-client',
    jti: 'token-id-123',
  };

  function makeJwt(payload: object): string {
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `header.${b64}.signature`;
  }

  it('returns parsed token for a valid JWT', () => {
    const result = verifyToken(makeJwt(validPayload));
    expect(result.sub).toBe('user123');
    expect(result.active).toBe(true);
  });

  it('calls logger.warn and throws on invalid token with logger', () => {
    const mockLogger = { warn: vi.fn() } as any;
    expect(() => verifyToken('no.dots', mockLogger)).toThrow();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('uses console.log and throws on invalid token without logger', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => verifyToken('no.dots')).toThrow();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('throws when payload fails schema validation', () => {
    const mockLogger = { warn: vi.fn() } as any;
    expect(() => verifyToken(makeJwt({ foo: 'bar' }), mockLogger)).toThrow();
  });
});
