import AutoLoad from '@fastify/autoload';
import Cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Sensible from '@fastify/sensible';
import fastifySwagger from '@fastify/swagger';
import apiReference from '@scalar/fastify-api-reference';
import { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authorization from '../plugins/authorization.js';
import introspect from '../plugins/introspect.js';
import requestId from '../plugins/requestId.js';
import type { MPlugins } from '../types/fastify.js';
import fetchInjection from '../plugins/fetchInjection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesPath = path.resolve(__dirname, '..', 'routes');

const app: FastifyPluginAsync<MPlugins> = async (
  fastify,
  opts
): Promise<void> => {
  // `fastify-sensible` adds many  small utilities, such as nice http errors.
  await fastify.register(Sensible);

  // Enables the use of CORS in a Fastify application.
  // https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
  await fastify.register(Cors, {
    origin: false,
  });
  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });
  await fastify.register(requestId, { requestIDName: 'x-request-id' });
  await fastify.register(fastifySwagger, {
    mode: 'dynamic',
    swagger: {
      info: {
        title: opts.main.app.name,
        description: opts.main.app.description,
        version: opts.main.app.version,
      },
      basePath: `/`,
      host: '0.0.0.0',
    },
    openapi: {
      info: {
        title: opts.main.app.name,
        description: opts.main.app.description,
        version: opts.main.app.version,
      },
    },
  });

  // Render an API reference for a given OpenAPI/Swagger spec URL
  await fastify.register(apiReference, {
    routePrefix: `/${opts.main.app.name}-docs`,
    configuration: {
      content: () => fastify.swagger(),
    },
  });

  // Normally you would need to load by hand each plugin. `fastify-autoload` is an utility
  // we wrote to solve this specific problems. It loads all the content from the specified
  // folder, even the subfolders. Take at look at its documentation, as it's doing a lot more!
  await fastify.register(introspect, opts.introspector);
  await fastify.register(authorization, opts.authorization);
  await fastify.register(fetchInjection, opts.fetchInjection);

  // Then, we'll load all of our routes.
  await fastify.register(AutoLoad, {
    dir: routesPath,
    dirNameRoutePrefix: false,
    options: Object.assign({}, opts.main),
  });
};

export default app;
export { app };
