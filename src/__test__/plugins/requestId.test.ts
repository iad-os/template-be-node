import { describe, it, expect, afterEach } from 'vitest';
import { fastify as createFastify, FastifyInstance } from 'fastify';
import requestIdPlugin from '../../plugins/requestId.js';

let app: FastifyInstance;

afterEach(async () => {
  await app?.close();
});

async function buildApp() {
  const instance = createFastify({ logger: false });
  await instance.register(requestIdPlugin, { requestIDName: 'x-request-id' });
  instance.get('/', async (req, reply) => reply.send({ reqId: req.reqId }));
  await instance.ready();
  return instance;
}

describe('requestId plugin', () => {
  it('generates an x-request-id header in the response', async () => {
    app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect((res.headers['x-request-id'] as string).length).toBeGreaterThan(0);
  });

  it('reuses the x-request-id from the incoming request', async () => {
    app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'x-request-id': 'my-custom-id' },
    });

    expect(res.headers['x-request-id']).toBe('my-custom-id');
  });

  it('sets req.reqId accessible in the route handler', async () => {
    app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'x-request-id': 'handler-test-id' },
    });

    expect(JSON.parse(res.body).reqId).toBe('handler-test-id');
  });

  it('generates a different id for each request when no header is provided', async () => {
    app = await buildApp();
    const res1 = await app.inject({ method: 'GET', url: '/' });
    const res2 = await app.inject({ method: 'GET', url: '/' });

    expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
  });
});
