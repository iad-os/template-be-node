import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFetchInjection } from '../../plugins/fetchInjection.js';
import { FetchError } from '../../errors/FetchError.js';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as any;

const opts = { headerKeys: ['authorization'] };

describe('createFetchInjection', () => {
  it('sets req.fetch on the request', async () => {
    const req = { headers: { authorization: 'Bearer token123' } } as any;
    const reply = {} as any;
    const fetchInjection = createFetchInjection({ logger: mockLogger, opts });

    await fetchInjection(req, reply);

    expect(typeof req.fetch).toBe('function');
  });

  it('injects the configured headers into fetch calls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: 'ok' }) })
    );

    const req = { headers: { authorization: 'Bearer token123', 'x-other': 'ignored' } } as any;
    const fetchInjection = createFetchInjection({ logger: mockLogger, opts });
    await fetchInjection(req, {} as any);

    await req.fetch('https://api.example.com/resource');

    const mockFetch = vi.mocked(globalThis.fetch);
    const callInit = mockFetch.mock.calls[0][1] as RequestInit;
    expect((callInit.headers as Record<string, string>).authorization).toBe('Bearer token123');
    expect((callInit.headers as Record<string, string>)['x-other']).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('merges caller-provided headers on top of injected headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    );

    const req = { headers: { authorization: 'Bearer injected' } } as any;
    const fetchInjection = createFetchInjection({ logger: mockLogger, opts });
    await fetchInjection(req, {} as any);

    await req.fetch('https://api.example.com/resource', {
      headers: { authorization: 'Bearer override', 'x-custom': 'yes' },
    });

    const mockFetch = vi.mocked(globalThis.fetch);
    const callInit = mockFetch.mock.calls[0][1] as RequestInit;
    expect((callInit.headers as Record<string, string>).authorization).toBe('Bearer override');
    expect((callInit.headers as Record<string, string>)['x-custom']).toBe('yes');

    vi.unstubAllGlobals();
  });

  it('returns the response JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ result: 42 }) })
    );

    const req = { headers: {} } as any;
    const fetchInjection = createFetchInjection({ logger: mockLogger, opts: { headerKeys: [] } });
    await fetchInjection(req, {} as any);

    const result = await req.fetch('https://api.example.com/data');
    expect(result).toEqual({ result: 42 });

    vi.unstubAllGlobals();
  });

  it('throws FetchError when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access denied'),
      })
    );

    const req = { headers: {} } as any;
    const fetchInjection = createFetchInjection({ logger: mockLogger, opts: { headerKeys: [] } });
    await fetchInjection(req, {} as any);

    await expect(req.fetch('https://api.example.com/protected')).rejects.toBeInstanceOf(FetchError);

    vi.unstubAllGlobals();
  });

  it('throws FetchError with correct status code on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: () => Promise.resolve('down'),
      })
    );

    const req = { headers: {} } as any;
    const fetchInjection = createFetchInjection({ logger: mockLogger, opts: { headerKeys: [] } });
    await fetchInjection(req, {} as any);

    const err = await req.fetch('https://api.example.com/').catch((e: FetchError) => e);
    expect(err).toBeInstanceOf(FetchError);
    expect((err as FetchError).statusCode).toBe(503);

    vi.unstubAllGlobals();
  });
});
