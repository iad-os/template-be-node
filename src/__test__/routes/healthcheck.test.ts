import { describe, it, expect, vi, afterEach } from 'vitest';
import { fastify as createFastify, FastifyInstance } from 'fastify';

const mockHealthcheck = vi.fn();

vi.mock('../../config/Irene.js', () => ({
  default: { healthcheck: mockHealthcheck },
}));

let app: FastifyInstance;

afterEach(async () => {
  await app?.close();
  vi.clearAllMocks();
});

async function buildApp() {
  const { default: healthcheck } = await import('../../routes/healthcheck.js');
  const instance = createFastify({ logger: false });
  await instance.register(healthcheck);
  await instance.ready();
  return instance;
}

describe('GET /healthcheck', () => {
  it('returns 200 with status ok when application is healthy', async () => {
    mockHealthcheck.mockResolvedValue({ healthy: true });
    app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('returns 500 with status ko when application is unhealthy', async () => {
    mockHealthcheck.mockResolvedValue({ healthy: false });
    app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ status: 'ko' });
  });
});
