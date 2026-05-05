import { describe, it, expect, vi } from 'vitest';
import { extractToken, decodeToken, verifyToken } from '../../utils/token.js';

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

describe('extractToken', () => {
  it('returns the payload segment of a JWT string', () => {
    expect(extractToken('header.payload.signature')).toBe('payload');
  });

  it('returns the second segment regardless of content', () => {
    const b64 = Buffer.from('{"foo":"bar"}').toString('base64');
    expect(extractToken(`h.${b64}.s`)).toBe(b64);
  });
});

describe('decodeToken', () => {
  it('decodes a base64-encoded string', () => {
    const encoded = Buffer.from('hello world').toString('base64');
    expect(decodeToken(encoded)).toBe('hello world');
  });

  it('decodes a base64-encoded JSON payload', () => {
    const json = JSON.stringify({ key: 'value' });
    const encoded = Buffer.from(json).toString('base64');
    expect(JSON.parse(decodeToken(encoded))).toEqual({ key: 'value' });
  });
});

describe('verifyToken', () => {
  it('returns parsed token for a valid JWT', () => {
    const result = verifyToken(makeJwt(validPayload));
    expect(result).toBeDefined();
    expect(result?.active).toBe(true);
    expect(result?.sub).toBe('user123');
    expect(result?.iss).toBe('https://issuer.example.com');
  });

  it('applies default cached = false', () => {
    const result = verifyToken(makeJwt(validPayload));
    expect(result?.cached).toBe(false);
  });

  it('returns undefined for a token with missing required fields', () => {
    const result = verifyToken(makeJwt({ foo: 'bar' }));
    expect(result).toBeUndefined();
  });

  it('returns undefined for a token with no dots (invalid JWT format)', () => {
    const result = verifyToken('nodots');
    expect(result).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    const result = verifyToken('');
    expect(result).toBeUndefined();
  });

  it('uses logger.warn on parse failure', () => {
    const mockLogger = { warn: vi.fn() } as any;
    verifyToken('bad.token.here', mockLogger);
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
