import { describe, it, expect, afterEach } from 'vitest';
import { fastify as createFastify, FastifyInstance } from 'fastify';
import Template from '../../routes/template.js';

let app: FastifyInstance;

afterEach(async () => {
  await app?.close();
});

describe('GET /template', () => {
  it('responds with Hello World message', async () => {
    app = createFastify({ logger: false });
    await app.register(Template);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ message: 'Hello World' });
  });
});
