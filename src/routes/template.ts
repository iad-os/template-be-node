import { FastifyPluginAsync } from 'fastify';
import { MPlugins } from '../types/fastify.js';

export const autoPrefix = '/template';

const Template: FastifyPluginAsync<MPlugins['main']> = async fastify => {
  // const { authorize, fetchInjection } = fastify;

  // fastify.addHook('onRequest', fetchInjection); // use this to inject fetch
  // fastify.addHook('onRequest', authorize); // use this to authorize

  fastify.get('/', async (_, reply) => {
    return reply.send({ message: 'Hello World' });
  });
};

export default Template;
