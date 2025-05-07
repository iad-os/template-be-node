import fastify from 'fastify';
import app from './config/apiServer.js';
import { GhiiOptions } from './config/options.js';
import irene from './config/Irene.js';
import { nanoid } from 'nanoid';
import { optionsLog } from './config/log.js';

const HTTP_PORT = process.env.PORT ?? 3000;
const HTTP_HOST = process.env.HOST_BINDING
  ? { host: process.env.HOST_BINDING }
  : {};
async function start(opts: GhiiOptions) {
  const { authOpts, ...otherOpts } = opts;
  const server = await fastify({
    logger: optionsLog({ tags: ['server', 'routes'] }),
    genReqId: () => nanoid(),
    requestIdHeader: 'x-request-id',
  });

  await server.register(app, {
    introspector: {
      cache: authOpts.enableCache
        ? (authOpts.cacheOpts ?? { introspectTTL: 1, size: 1000 })
        : false,
      issuer: {
        clientId: authOpts.client.clientId,
        clientSecret: authOpts.client.clientSecret,
        introspectionEndpoint: authOpts.introspectionEndpoint,
        audience: authOpts.audience,
      },
    },
    fetchInjection: opts.fetchInjectionOpts,
    authorization: opts.authOpts,
    main: otherOpts,
  });
  try {
    const addr = await server.listen({
      port: normalizePort(HTTP_PORT),
      ...HTTP_HOST,
    });

    server.log.info(`server listening on ${addr}`);
  } catch (err) {
    server.log.error(err);
    irene.kill(err);
  }

  return server;
}

function normalizePort(val: string | number): number {
  const port = typeof val === 'number' ? val : parseInt(val, 10);

  if (isNaN(port) || port < 0 || port > 65535) {
    throw new Error(`Port specified is not valid! RECEIVED ${port}`);
  }

  // port number
  return port;
}

export default { start };
