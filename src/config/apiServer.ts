import AutoLoad from '@fastify/autoload';
import Cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Sensible from '@fastify/sensible';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { FastifyPluginAsync } from 'fastify';
import { kebabCase } from 'lodash-es';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authorization from '../shared/plugins/authorization.js';
import introspect from '../shared/plugins/introspect.js';
import requestId from '../shared/plugins/requestId.js';
import type { MPlugins } from '../shared/types/fastify.js';

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
  await fastify.register(helmet, { global: true });
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
      swagger: '2.0',
    },
  });

  await fastify.register(fastifySwaggerUI, {
    routePrefix: `/${kebabCase(`${opts.main.app.name}-docs`)}`,
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    staticCSP: true,
  });

  // Normally you would need to load by hand each plugin. `fastify-autoload` is an utility
  // we wrote to solve this specific problems. It loads all the content from the specified
  // folder, even the subfolders. Take at look at its documentation, as it's doing a lot more!
  await void fastify.register(introspect, opts.introspector);
  await void fastify.register(authorization, opts.authorization);

  // Then, we'll load all of our routes.
  await fastify.register(AutoLoad, {
    dir: routesPath,
    dirNameRoutePrefix: false,
    options: Object.assign({}, opts.main),
  });
};

export default app;
export { app };
